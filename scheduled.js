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

module.exports = {
    start
};

const cron = require('node-cron');
const moment = require('moment');

let client;
async function start(dc) {
    client = dc;
    cron.schedule('0 10 * * 1', capitalWeekendRaid);
    //capitalWeekendRaid();
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


