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
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ApplicationCommandPermissionType, EmbedBuilder } = require('discord.js');

module.exports = {
  start
};

const cron = require('node-cron');
const schedule = require('node-schedule');
const clan = require('./commands/clan.js');
const moment = require('moment-timezone')

const dcWarSchedduled = []
const dcLeagueSchedduled = []
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

let client;
async function start(dc) {
  client = dc;
  cron.schedule('0 10 * * 1', capitalWeekendRaid);
  //capitalWeekendRaid();
  cron.schedule('0 0 * * *', warRequest);
  cron.schedule('0 12 * * *', warRequest);
  cron.schedule('0 15 * * *', clanWarLeagueCheck);
  warRequest();
  clanWarLeagueCheck();
}

async function clanWarLeagueCheck() {
  const allServers = await query('SELECT * FROM guildToClan WHERE notifyChannelId IS NOT NULL;');

  if (allServers && allServers.length) {
    for (let item of allServers) {
      const clantag = item.clanTag;
      const guildID = item.guildID;

      //check if not already schedduled
      if (!dcLeagueSchedduled.includes(guildID)) {
        await axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clantag) + '/currentwar/leaguegroup', config)
          .then(async function (response) {

            //Check if all tags are there
            let rounds = response.data.rounds;
            let season = response.data.season;
            let lastRound = rounds[rounds.length - 1];
            if (lastRound.warTags[0] == "#0") {
              console.log("last WarTag of CWL is still #0, waiting...");
            }
            else {
              //If all the WarTags are there, take the last war and see when it ends
              await axios.get(cocApiDomain + '/v1/clanwarleagues/wars/' + pre.routConvert(lastRound.warTags[0]), config)
                .then(async function (warResponse) {
                  if (warResponse.data.state == "warEnded") {
                    //if war is ended, save now, this case should not be possible but idk
                    console.log("war of CWL is already ended, this should not be possible but yeah... triggering end NOW");
                    await clanWarLeagueEnd(guildID, clantag, item.notifyChannelId, rounds, season);
                  }
                  else {
                    const endingWarTime = moment.utc(warResponse.data.endTime, 'YYYYMMDDTHHmmss.SSS[Z]');
                    const apiCallTime = moment.utc(endingWarTime).add(1, 'minute').startOf('minute');

                    scheduleLeagueExecution(apiCallTime, guildID, clantag, item.notifyChannelId, rounds, season);

                  }
                })
                .catch(function (error) {
                  throw error;
                });

            }

          })
          .catch(function (error) {
            if (error.response.status == 404 && error.response.data.reason == "notFound") {
              console.error("clan not in CWL");
            }
            else {
              throw error;
            }
          });
      }
    }
  }
}

async function scheduleLeagueExecution(apiCallTime, guildID, clantag, notifyChannelId, rounds, season) {
  const localEndingWarTime = apiCallTime.tz(localTimeZone);

  const minute = localEndingWarTime.minute();
  const hour = localEndingWarTime.hour();
  const dayOfMonth = localEndingWarTime.date();
  const month = localEndingWarTime.month();
  const scheduleString = `${minute} ${hour} ${dayOfMonth} ${month + 1} *`;

  dcLeagueSchedduled.push(guildID)

  console.log("LeagueEnd schedduled for guild " + guildID + "(channel: " + notifyChannelId + ") with clan " + clantag + " at " + localEndingWarTime.toString());

  const job = schedule.scheduleJob(scheduleString, () => {
    // Remove guildID from arraY
    const index = dcLeagueSchedduled.indexOf(guildID);
    if (index > -1) {
      dcLeagueSchedduled.splice(index, 1);
    } else {
      console.error("league: Something went wrong, guildid was not found in array but scheduled")
    }

    clanWarLeagueEnd(guildID, clantag, notifyChannelId, rounds, season);
  });

}

async function clanWarLeagueEnd(guildID, clantag, notifyChannelId, rounds, season) {
  var warIDs = [];
  //Every round
  for (let round of rounds) {
    //check if all data is there, otherwise log error
    for (let warTag of round.warTags) {
      if (warTag == "#0") {
        console.error("error: some warTag from CLW was still #0");
        return;
      }
    }
    //Every war in Round (just one of this is the correct clan though)
    let warID = 0;
    for (let warTag of round.warTags) {

      await axios.get(cocApiDomain + '/v1/clanwarleagues/wars/' + pre.routConvert(warTag), config)
        .then(async function (response) {
          if (response.data.state == "warEnded") {
            //searching for the correct clan
            if (response.data.clan.tag == clantag) {
              //console.log("True");
              warID = await clanWarLeagueWarSave(response.data, response.data.clan, response.data.opponent, notifyChannelId, guildID);
            }
            else if (response.data.opponent.tag == clantag) {
              //console.log("True");
              warID = await clanWarLeagueWarSave(response.data, response.data.opponent, response.data.clan, notifyChannelId, guildID);
            }
            else {
              //console.log("False");
            }
          }
          else {
            console.error("Some war has not ended, but it should have")
          }
        })
        .catch(function (error) {
          throw error;
        });

      if (warID != 0) {
        //console.log("BREAK");
        break; // Exit the loop if clan was found in a war of all the wars in thr group
      }

      //Wait between clanwarleague war request
      await pre.delay(1500);
    }

    warIDs.push(warID);
  }

  await new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO clanwarleagues (season, clanTag, guildID, warIDs) VALUES (?, ?, ?, ?)",
      [
        season,
        clantag,
        guildID,
        JSON.stringify(warIDs)
      ],
      (err, result, fields) => {
        if (err) reject(err);
        resolve();
      }
    );
  });

  let postMessage = "CWL is over!\nThank you to everyone who attacked! :heart: :crossed_swords: \nThis was season " + season + "\n\n Data will be saved now :)";

  const buttonsRow1 = new ActionRowBuilder();

  let currentRow = buttonsRow1; // Start adding buttons to the first row

  var newButton = new ButtonBuilder()
    .setCustomId(`cwllog_all_` + season)
    .setLabel('All')
    .setStyle(ButtonStyle.Primary);

  currentRow.addComponents(newButton);

  let buttonCount = 1;
  for (const id of warIDs) {
    const newButton = new ButtonBuilder()
      .setCustomId(`cwllog_${id}`)
      .setLabel(`Day ${buttonCount}`)
      .setStyle(ButtonStyle.Primary);

    currentRow.addComponents(newButton);
    buttonCount++;

    // Check if we need to create a second row
    if (buttonCount === 5) {
      currentRow = new ActionRowBuilder();
    }
  }

  // Only include buttonsRow2 if it has buttons
  const components = [buttonsRow1];
  if (currentRow.components.length > 0) {
    components.push(currentRow);
  }

  // Send the message with all the action rows
  const channel = await client.channels.fetch(notifyChannelId);
  await channel.send({ content: postMessage, components });
}


async function clanWarLeagueWarSave(war, ourClan, opponentClan, notifyChannelId, guildId) {


  const channel = await client.channels.fetch(notifyChannelId);

  let startWarTime = moment.utc(war.startTime, 'YYYYMMDDTHHmmss.SSS[Z]');
  let warstartTimeSQL = startWarTime.format('YYYY-MM-DD');

  var won;
  if (ourClan.stars == opponentClan.stars) {
    if (ourClan.destructionPercentage > opponentClan.destructionPercentage) {
      won = "true";
    }
    else if (ourClan.destructionPercentage < opponentClan.destructionPercentage) {
      won = "false";
    }
    else {
      won = "same score";
    }
  }
  else if (ourClan.stars > opponentClan.stars) {
    won = "true";
  }
  else if (ourClan.stars < opponentClan.stars) {
    won = "false";
  }
  else {
    won = "error";
  }

  function getOpponentMapPosition(opponentMembers, memberTag) {

    for (const member of opponentMembers) {
      if (member.tag === memberTag) {
        return member.mapPosition;
      }
    }
    return null;
  }

  function getOpponentName(opponentMembers, memberTag) {

    for (const member of opponentMembers) {
      if (member.tag === memberTag) {
        return member.name;
      }
    }
    return null;
  }

  function fillWithZeroIfNotAttacked(arr) {
    if (arr.length === 1) {
      return arr;
    }
    for (let i = arr.length; i < 1; i++) {
      arr.push(0);
    }

    return arr;
  }


  const attackPromise = new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO clanwars (clanTag, isLeague, guildID, warStartDay, opponentTag, opponentName, won, teamSize, clanUsedAttacks, opponentUsedAttacks, clanStars, opponentStars, clanPercentage, opponentPercentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        ourClan.tag,
        true,
        guildId,
        warstartTimeSQL,
        opponentClan.tag,
        opponentClan.name,
        won,
        war.teamSize,
        ourClan.attacks,
        opponentClan.attacks,
        ourClan.stars,
        opponentClan.stars,
        ourClan.destructionPercentage,
        opponentClan.destructionPercentage
      ],
      (err, result, fields) => {
        if (err) reject(err);
        resolve(result.insertId);
      }
    );
  });

  const warId = await attackPromise;

  for (let member of ourClan.members) {
    var attackIDs = [];

    if (member.hasOwnProperty('attacks')) {
      for (const attack of member.attacks) {
        const attackPrimise = new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO clanwarattacks (defenderTag, defenderName, defenderPosition, stars, destructionPercentage) VALUES (?, ?, ?, ?, ?)",
            [
              attack.defenderTag,
              getOpponentName(opponentClan.members, attack.defenderTag),
              getOpponentMapPosition(opponentClan.members, attack.defenderTag),
              attack.stars,
              attack.destructionPercentage
            ],
            (err, result, fields) => {
              if (err) reject(err);
              resolve(result.insertId);
            }
          );
        });

        attackIDs.push(await attackPrimise);
      }
    }

    //Fill with 0, when attack1 or attack2 is 0 that means "didnt attack"
    attackIDs = fillWithZeroIfNotAttacked(attackIDs);

    db.query(
      "INSERT INTO clanwarleaguemembers (warId, memberTag, memberName, memberPosition, attack) VALUES (?, ?, ?, ?, ?)",
      [
        warId,
        member.tag,
        member.name,
        member.mapPosition,
        attackIDs[0]
      ],
      (err, result, fields) => {
        if (err) throw (err);
      }
    );
  }
  return warId;
}

async function capitalWeekendRaid() {

  const allServers = await query('SELECT * FROM guildToClan WHERE notifyChannelId IS NOT NULL');

  if (allServers && allServers.length) {
    for (let item of allServers) {
      const clantag = item.clanTag;
      const guildID = item.guildID;

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
                membersListToSave.push({ tag: member.tag, knownName: name, attacked: attacks });
                i++;
              }
              //Find who didnt attack
              const users = await query('SELECT userTag, userName FROM users WHERE guildID = ' + item.guildID);
              if (users && users.length) {

                let notAttacking = users.filter(user => {
                  return !attackingmembers.some(attacker => attacker.tag === user.userTag);
                });
                if (notAttacking.length > 0) {
                  postChunks.push("\n\nThese people did not attack this week:\n");
                  let i = 1;
                  for (let notAttackingMember of notAttacking) {
                    postChunks.push(i + ". " + notAttackingMember.userName + " (" + notAttackingMember.userTag + ")\n");
                    //add to list for saving it later
                    membersListToSave.push({ tag: notAttackingMember.userTag, knownName: notAttackingMember.userName, attacked: 0 });

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

  /*db.query("DELETE FROM capitalRaids WHERE timeAdded < DATE_SUB(NOW(), INTERVAL " + weeksToSaveCapitalRaids + " WEEK);",
    function (err, result, fields) {
      if (err) throw err;
    });*/
}


const fs = require('fs').promises;

async function scheduleWarExecution(apiCallTime, guildID, clantag, notifyChannelId) {
  const localEndingWarTime = apiCallTime.tz(localTimeZone);

  const minute = localEndingWarTime.minute();
  const hour = localEndingWarTime.hour();
  const dayOfMonth = localEndingWarTime.date();
  const month = localEndingWarTime.month();
  const scheduleString = `${minute} ${hour} ${dayOfMonth} ${month + 1} *`;

  dcWarSchedduled.push(guildID)

  console.log("War schedduled for guild " + guildID + "(channel: " + notifyChannelId + ") with clan " + clantag + " at " + localEndingWarTime.toString());

  const job = schedule.scheduleJob(scheduleString, () => {
    //remove from array
    const index = dcWarSchedduled.indexOf(guildID);
    if (index > -1) {
      dcWarSchedduled.splice(index, 1);
    } else {
      console.error("war: Something went wrong, guildid was not found in array but scheduled")
    }

    warOver(guildID, clantag, notifyChannelId);
  });

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
      /*const interaction = {};
      interaction.guildId = guildId;
      await pre.updateClanMembers(interaction);
      await pre.delay(4000);*/


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

      let postMessage = "Clanwar is over!\nThank you to everyone who attacked! :heart: :crossed_swords:";

      const warInfo = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle("War info")
        .setDescription(startedAt?.toString() + " - " + endedAt?.toString())
        .addFields(
          { name: 'Won', value: won },
          { name: 'War size', value: (war.teamSize?.toString() || "N/A") },
          { name: 'Attacks used', value: `${war.clan?.attacks || "N/A"} - ${war.opponent?.attacks || "N/A"}` },
          { name: 'Stars', value: `${war.clan?.stars || "N/A"} - ${war.opponent?.stars || "N/A"}` },
          { name: 'Percentage destroyed', value: `${war.clan?.destructionPercentage || "N/A"} - ${war.opponent?.destructionPercentage || "N/A"}` },
        )

        .setTimestamp()
        .setFooter({ text: 'This will be saved now :)' });

      const warLogButton = new ButtonBuilder()
        .setCustomId('warlog_' + warstartTimeSQL)
        .setLabel('War Log')
        .setStyle(ButtonStyle.Primary);

      const buttons = new ActionRowBuilder()
        .addComponents(warLogButton);

      await channel.send({ content: postMessage, embeds: [warInfo], components: [buttons] });

      function getOpponentMapPosition(clanWarData, memberTag) {
        const opponentMembers = clanWarData.opponent.members;

        for (const member of opponentMembers) {
          if (member.tag === memberTag) {
            return member.mapPosition;
          }
        }
        return null;
      }

      function getOpponentName(clanWarData, memberTag) {
        const opponentMembers = clanWarData.opponent.members;

        for (const member of opponentMembers) {
          if (member.tag === memberTag) {
            return member.name;
          }
        }
        return null;
      }

      function fillToTwoWithNumZero(arr) {
        if (arr.length === 2) {
          return arr;
        }
        for (let i = arr.length; i < 2; i++) {
          arr.push(0);
        }

        return arr;
      }



      const attackPromise = new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO clanwars (clanTag, isLeague, guildID, warStartDay, opponentTag, opponentName, won, teamSize, clanUsedAttacks, opponentUsedAttacks, clanStars, opponentStars, clanPercentage, opponentPercentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            clanTag,
            false,
            guildId,
            warstartTimeSQL,
            war.opponent.tag,
            war.opponent.name,
            won,
            war.teamSize,
            war.clan.attacks,
            war.opponent.attacks,
            war.clan.stars,
            war.opponent.stars,
            war.clan.destructionPercentage,
            war.opponent.destructionPercentage
          ],
          (err, result, fields) => {
            if (err) reject(err);
            resolve(result.insertId);
          }
        );
      });

      const warId = await attackPromise;

      for (let member of war.clan.members) {
        var attackIDs = [];

        if (member.hasOwnProperty('attacks')) {
          for (const attack of member.attacks) {
            const attackPrimise = new Promise((resolve, reject) => {
              db.query(
                "INSERT INTO clanwarattacks (defenderTag, defenderName, defenderPosition, stars, destructionPercentage) VALUES (?, ?, ?, ?, ?)",
                [
                  attack.defenderTag,
                  getOpponentName(war, attack.defenderTag),
                  getOpponentMapPosition(war, attack.defenderTag),
                  attack.stars,
                  attack.destructionPercentage
                ],
                (err, result, fields) => {
                  if (err) reject(err);
                  resolve(result.insertId);
                }
              );
            });

            attackIDs.push(await attackPrimise);
          }
        }

        //Fill with 0, when attack1 or attack2 is 0 that means "didnt attack"
        attackIDs = fillToTwoWithNumZero(attackIDs);

        db.query(
          "INSERT INTO clanwarmembers (warId, memberTag, memberName, memberPosition, attack1, attack2) VALUES (?, ?, ?, ?, ?, ?)",
          [
            warId,
            member.tag,
            member.name,
            member.mapPosition,
            attackIDs[0],
            attackIDs[1]
          ],
          (err, result, fields) => {
            if (err) throw (err);
          }
        );
      }
    })
    .catch(function (error) {
      throw error;
    });
}


async function warRequest() {

  const allServers = await query('SELECT * FROM guildToClan WHERE notifyChannelId IS NOT NULL'); //466971916108824577
  if (allServers && allServers.length) {
    for (let item of allServers) {
      const clantag = item.clanTag;
      const guildID = item.guildID;

      await axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clantag) + '/currentwar', config)
        .then(async function (response) {
          const war = response.data;

          const endingWarTime = moment.utc(war.endTime, 'YYYYMMDDTHHmmss.SSS[Z]');
          const apiCallTime = moment.utc(endingWarTime).startOf('minute');

          if (war.state == "inWar" /*|| war.state == "preparation"*/) {
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