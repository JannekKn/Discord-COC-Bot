//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain, weeksToSaveCapitalRaids } = require('./config.json');
//Database file
var db = require('./db');
//Config for api request
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };
//imports premade functions 
const pre = require("./preset/premade.js");
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);
//discord button builder
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

module.exports = {
  start
};

const cron = require('node-cron');
const moment = require('moment');
const clan = require('./commands/clan.js');

const dcWarSchedduled = []

let client;
async function start(dc) {
  client = dc;
  cron.schedule('0 10 * * 1', capitalWeekendRaid);
  //capitalWeekendRaid();
  cron.schedule('0 0 * * *', warRequest);
  cron.schedule('0 12 * * *', warRequest);
  warRequest();
}

async function capitalWeekendRaid() {

  const allServers = await query('SELECT * FROM guildToClan WHERE notifyChannelId IS NOT NULL');

  if (allServers && allServers.length) {
    for (let item of allServers) {
      const clantag = item.clanTag;
      const guildID = item.guildID;

      console.log(clantag)

      await axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clantag) + '/capitalraidseasons', config)
        .then(async function (response) {
          if (response.data.items.length > 0) {
            const newestCapitalRaid = response.data.items[0];

            let endTime = moment.utc(newestCapitalRaid.endTime, 'YYYYMMDDTHHmmss.SSS[Z]');
            let startTime = moment.utc(newestCapitalRaid.startTime, 'YYYYMMDDTHHmmss.SSS[Z]');
            let now = moment.utc();
            let oneDaysAgo = moment.utc().subtract(3, 'days');
            if (endTime.isBetween(oneDaysAgo, now) && newestCapitalRaid.state == "ended") {
              //create an interaction, because i programmed updating like that...
              const interaction = {};
              interaction.guildId = guildID;
              await pre.updateClanMembers(interaction);
              await pre.delay(4000);


              //for saving it in the database later
              let membersListToSave = [];

              const channel = await client.channels.fetch(item.notifyChannelId);
              let startedAt = startTime.format('DD.MM.YYYY');
              let endedAt = endTime.format('DD.MM.YYYY');
              let postChunks = [];
              postChunks.push("Raid Weekend is over!\nThank you to everyone who attacked! :heart:\n")
              postChunks.push(startedAt + " - " + endedAt);
              postChunks.push("\nTotal Loot: " + newestCapitalRaid.capitalTotalLoot);
              postChunks.push("\nRaids completed: " + newestCapitalRaid.raidsCompleted);
              postChunks.push("\nTotal attacks: " + newestCapitalRaid.totalAttacks);
              postChunks.push("\nEnemy districts destroyed: " + newestCapitalRaid.enemyDistrictsDestroyed);
              postChunks.push("\nOffensive reward: " + newestCapitalRaid.offensiveReward);
              postChunks.push("\nDefensive reward: " + newestCapitalRaid.defensiveReward);
              postChunks.push("\nMembers who attacked:\n");

              var i = 1;
              //everyone that attacked
              let attackingmembers = newestCapitalRaid.members;
              await attackingmembers.sort((a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted);
              for (let member of attackingmembers) {
                let name = member.name;
                let attacks = member.attacks;
                let possibleAttacks = member.attackLimit + member.bonusAttackLimit;
                let looted = member.capitalResourcesLooted;
                postChunks.push(i + ". " + name + " (" + attacks + "/" + possibleAttacks + " attacks, " + looted + " looted)\n");

                //add to list for saving it later
                membersListToSave.push({ tag: member.tag, knownName: name, attacked: true });
                i++;
              }
              //Find who didnt attack
              const users = await query('SELECT userTag, userName FROM users WHERE guildID = ' + item.guildID);
              if (users && users.length) {

                let notAttacking = users.filter(user => {
                  return !attackingmembers.some(attacker => attacker.tag === user.userTag);
                });
                console.log(notAttacking)
                if (notAttacking.length > 0) {
                  postChunks.push("\n\nThese people did not attack this week:\n");
                  let i = 1;
                  for (let notAttackingMember of notAttacking) {
                    postChunks.push(i + ". " + notAttackingMember.userName + " (" + notAttackingMember.userTag + ")\n");
                    //add to list for saving it later
                    membersListToSave.push({ tag: notAttackingMember.userTag, knownName: notAttackingMember.userName, attacked: false });

                    i++;
                  }
                }
                else {
                  postChunks.push("\n\nIn this Raid everyone from your clan attacked!");
                }
              }

              postChunks.push("\nThis will now save to the database :)");

              const chunks = [];
              const maxLength = 1999;
              let currentChunk = '';
              postChunks.forEach(line => {
                if ((currentChunk + line).length <= maxLength) {
                  currentChunk += line;
                } else {
                  chunks.push(currentChunk.trim());
                  currentChunk = line;
                }
              });

              if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
              }

              for (let chunk of chunks) {
                await channel.send({ content: chunk });
              }

              for (let saveMember of membersListToSave) {
                db.query("INSERT INTO capitalRaids (timeAdded, clanTag, guildID, memberTag, memberName, attacked) VALUES (NOW(), " + db.escape(clantag) + ", " + db.escape(guildID) + ", " + db.escape(saveMember.tag) + ", " + db.escape(saveMember.knownName) + ", " + db.escape(saveMember.attacked) + ")",
                  function (err, result, fields) {
                    if (err) throw err;
                  });
              }
            }
          }
        })
        .catch(function (error) {
          throw error;
        });
    }
  }

  //Delete everything thats older than specified weeks

  db.query("DELETE FROM capitalRaids WHERE timeAdded < DATE_SUB(NOW(), INTERVAL " + weeksToSaveCapitalRaids + " WEEK);",
    function (err, result, fields) {
      if (err) throw err;
    });
}


const fs = require('fs').promises;

async function scheduleWarExecution(apiCallTime, guildID, clantag, notifyChannelId) {
  const currentTime = moment.utc();
  const timeDifferenceInMs = apiCallTime - currentTime;

  if (timeDifferenceInMs <= 10000) {
    console.log("The time difference was under 10seconds")
  } else {
    dcWarSchedduled.push(guildID)

    console.log("War schedduled for guild " + guildID + "(channel: " + notifyChannelId + ") with clan " + clantag + " in " + timeDifferenceInMs + "ms");

    setTimeout(async () => {
      await warOver(guildID, clantag, notifyChannelId);
    }, timeDifferenceInMs);
  }
}


async function warOver(guildId, clanTag, notifyChannelId) {
  await axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clanTag) + '/currentwar', config)
    .then(async function (response) {
      const war = response.data;
      const channel = await client.channels.fetch(notifyChannelId);

      let startPrepTime = moment.utc(war.preparationStartTime, 'YYYYMMDDTHHmmss.SSS[Z]');
      let startWarTime = moment.utc(war.startTime, 'YYYYMMDDTHHmmss.SSS[Z]');
      let endWarTime = moment.utc(war.endTime, 'YYYYMMDDTHHmmss.SSS[Z]');
      let warstartTimeSQL = startWarTime.format('YYYY-MM-DD');
      let startedAt = startWarTime.format('DD.MM.YYYY');
      let endedAt = endWarTime.format('DD.MM.YYYY');

      //create an interaction, because i programmed updating like that...
      const interaction = {};
      interaction.guildId = guildId;
      await pre.updateClanMembers(interaction);
      await pre.delay(4000);

      
      let postChunks = [];
      //Calculation, because the war ends in a few secs
      var won;
      if (war.clan.stars == war.opponent.stars) {
        if (war.clan.destructionPercentage > war.opponent.destructionPercentage) {
          won = "true";
        }
        else if (war.clan.destructionPercentage < war.opponent.destructionPercentage) {
          won = "false";
        }
        else {
          won = "same score";
        }
      }
      else if (war.clan.stars > war.opponent.stars) {
        won = "true";
      }
      else if (war.clan.stars < war.opponent.stars) {
        won = "false";
      }
      else {
        won = "error";
      }

      postChunks.push("Clanwar is over!\nThank you to everyone who attacked! :heart: :crossed_swords: \n")
      postChunks.push(startedAt + " - " + endedAt);
      postChunks.push("\nWon: " + won);
      postChunks.push("\nWar size: " + war.teamSize + "v" + war.teamSize);
      postChunks.push("\nUsed attacks: " + war.clan.attacks + " - " + war.opponent.attacks);
      postChunks.push("\nStars: " + war.clan.stars + " - " + war.opponent.attacks);
      postChunks.push("\nPercentage destroyed: " + war.clan.destructionPercentage + " - " + war.opponent.attacks);

      postChunks.push("\n\nThis war and who attacked will now save to the database :)");


      //for saving it in the database later
      let membersListToSave = [];

      for (let member of war.clan.members) {
        if (member.hasOwnProperty('attacks')) {
          membersListToSave.push({ tag: member.tag, knownName: member.name, attackCount: member.attacks.length });
        } else {
          membersListToSave.push({ tag: member.tag, knownName: member.name, attackCount: 0 });
        }
      }

      const warLogButton = new ButtonBuilder()
        .setCustomId('warlog_' + warstartTimeSQL)
        .setLabel('War Log')
        .setStyle(ButtonStyle.Primary);

      const buttons = new ActionRowBuilder()
        .addComponents(warLogButton);

      const chunks = [];
      const maxLength = 1999;
      let currentChunk = '';
      postChunks.forEach(line => {
        if ((currentChunk + line).length <= maxLength) {
          currentChunk += line;
        } else {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        }
      });

      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];


        // Check if it's the last iteration
        if (i === chunks.length - 1) {
          await channel.send({ content: chunk, components: [buttons] });
        }
        else {
          await channel.send({ content: chunk });
        }
      }

      for (let saveMember of membersListToSave) {
        db.query("INSERT INTO clanwars (warStartDay, clanTag, guildID, memberTag, memberName, attackCount) VALUES (" + db.escape(warstartTimeSQL) + ", " + db.escape(clanTag) + ", " + db.escape(guildId) + ", " + db.escape(saveMember.tag) + ", " + db.escape(saveMember.knownName) + ", " + db.escape(saveMember.attackCount) + ")",
          function (err, result, fields) {
            if (err) throw err;
          });
      }
    })
    .catch(function (error) {
      throw error;
    });
}


async function warRequest() {

  const allServers = await query('SELECT * FROM guildToClan WHERE notifyChannelId IS NOT NULL');
  if (allServers && allServers.length) {
    for (let item of allServers) {
      const clantag = item.clanTag;
      const guildID = item.guildID;

      await axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clantag) + '/currentwar', config)
        .then(async function (response) {
          const war = response.data;

          const endingWarTime = moment.utc(war.startTime, 'YYYYMMDDTHHmmss.SSS[Z]');
          const apiCallTime = endingWarTime.subtract(10, 'seconds');

          if (war.state == "inWar" || war.state == "preparation") {
            if (!dcWarSchedduled.includes(guildID)) {
              scheduleWarExecution(apiCallTime, guildID, clantag, item.notifyChannelId);
            }
          }
        })
        .catch(function (error) {
          throw error;
        });
    }
  }

  //Delete everything thats older than specified weeks

  /*db.query("DELETE FROM capitalRaids WHERE timeAdded < DATE_SUB(NOW(), INTERVAL " + weeksToSaveCapitalRaids + " WEEK);",
    function (err, result, fields) {
      if (err) throw err;
    });*/
}