var db = require('./../db');
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);
//Axios for requests
const axios = require('axios');
const moment = require('moment');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain } = require('../config.json');
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };

module.exports = {
    autoCompleteUsers,
    routConvert,
    autoCompleteCWLSeasons,
    autoCompleteCWLDay,
    updateClanMembers,
    delay,
    autoCompleteWarDates,
    updateSingleClanMember
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function autoCompleteUsers(interaction, guildId, value) {
    var userinput = db.escape('%' + value + '%');
    var users = await query("SELECT userName, userTag FROM users WHERE guildId = " + db.escape(guildId) + " AND userName LIKE " + userinput + " FETCH FIRST 25 ROWS ONLY;");

    //just give max of 25 suggestions because of discord maximum
    if (users.length > 25) {
        let users = users.slice(0, 25);
    }

    let suggestions = [];
    for (let i = 0; i < users.length; i++) {
        const name = users[i].userName;
        const tag = users[i].userTag;
        suggestions.push({ name: `${name}`, value: `${tag}` });
    }

    await interaction.respond(suggestions);
}

async function autoCompleteWarDates(interaction, guildId, value) {
    var userinput = db.escape('%' + value + '%');
    const result = await query("SELECT DISTINCT warStartDay FROM clanwars WHERE isLeague = 0 AND guildId = " + db.escape(guildId) + " AND warStartDay LIKE " + userinput + " ORDER BY warStartDay DESC FETCH FIRST 25 ROWS ONLY;");
    //Put all users into Array
    let array = [];
    for (let item of result) {
        const formattedDate = moment(item.warStartDay).format("YYYY-MM-DD");
        array.push(formattedDate);
    }

    //If there are more than 25 options, do nothing, becuase discord is stupid
    if (array.length <= 25) {
        await interaction.respond(
            array.map(choice => ({ name: choice, value: choice })),
        );
    }
}

async function autoCompleteCWLSeasons(interaction, guildId, value) {
    var userinput = db.escape('%' + value + '%');
    const result = await query("SELECT season FROM clanwarleagues WHERE guildId = " + db.escape(guildId) + " AND season LIKE " + userinput + " ORDER BY season DESC FETCH FIRST 25 ROWS ONLY;");
    //Put all users into Array
    let array = [];
    for (let item of result) {
        array.push(item.season);
    }

    //If there are more than 25 options, do nothing, becuase discord is stupid
    if (array.length <= 25) {
        await interaction.respond(
            array.map(choice => ({ name: choice, value: choice })),
        );
    }
}

async function autoCompleteCWLDay(interaction, guildId, value) {

    let season = interaction.options._hoistedOptions[0].value;

    let suggestions = [];


    if (season == null) {
        await interaction.respond(suggestions);
        return;
    }

    var seasoninput = db.escape('%' + season + '%');
    const result = await query("SELECT warIDs FROM clanwarleagues WHERE guildId = " + db.escape(guildId) + " AND season LIKE " + seasoninput + " ORDER BY season DESC FETCH FIRST 1 ROWS ONLY;");

    let warIDArray = [];

    if (result && result.length) {

        warIDArray = JSON.parse(result[0].warIDs);
    }

    // If there are more than 25 options, do nothing (limitation)
    if (warIDArray.length <= 25) {
        for (let i = 0; i < warIDArray.length; i++) {
            const warID = warIDArray[i];
            suggestions.push({ name: `${i + 1}`, value: warID.toString() });
        }

        await interaction.respond(suggestions);
    }
}

function routConvert(stringWithRout) {
    return stringWithRout.replace("#", "%23");
}

async function updateClanMembers(interaction) {
    console.log("Updating members");

    const rows = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
    if (rows && rows.length) {
        const clantag = rows[0].clanTag;

        //get clan members info
        await axios.get(cocApiDomain + '/v1/clans/' + routConvert(clantag) + '/members', config)
            .then(async function (response) {
                const users = response.data.items;

                // Create an array of Axios requests
                const axiosRequests = users.map(async (user) => {
                    const userResponse = await axios.get(cocApiDomain + '/v1/players/' + routConvert(user.tag), config);
                    const tag = userResponse.data.tag;
                    const name = userResponse.data.name;
                    const role = userResponse.data.role;
                    const warPreference = userResponse.data.warPreference;
                    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    // Update that info if needed
                    return new Promise((resolve, reject) => {
                        db.query("INSERT INTO users (guildId, userTag, userName, userRole, userWarPref, joined) VALUES (" + db.escape(interaction.guildId) + ", " + db.escape(tag) + ", " + db.escape(name) + ", " + db.escape(role) + ", " + db.escape(warPreference) + ", " + db.escape(currentDate) + ") ON DUPLICATE KEY UPDATE userName = " + db.escape(name) + ", userRole = " + db.escape(role) + ", userWarPref = " + db.escape(warPreference) + ";", function (err, result, fields) {
                            if (err) reject(err);
                            else resolve(tag);
                        });
                    });
                });

                // Execute all Axios requests concurrently
                const userTags = await Promise.all(axiosRequests);
                return userTags;
            })
            .then(function (userTags) {
                //delete people who are not in the clan anymore
                let userTagsAsString = "'" + userTags.join("','") + "'";

                var delUsers = [];

                db.query("SELECT userName FROM users WHERE guildId = '" + interaction.guildId + "' AND userTag NOT IN (" + userTagsAsString + ");", function (err, result, fields) {
                    if (err) throw err;
                    if (result && result.length) {
                        for (let item of result) {
                            delUsers.push(item.userName);
                        }
                    }

                    db.query("DELETE FROM users WHERE guildId = '" + interaction.guildId + "' AND userTag NOT IN (" + userTagsAsString + ");", function (err, result, fields) {
                        if (err) throw err;
                    });

                    db.query("DELETE FROM capitalRaids WHERE guildId = '" + interaction.guildId + "' AND memberTag NOT IN (" + userTagsAsString + ");", function (err, result, fields) {
                        if (err) throw err;
                    });

                });
            })
            .catch(function (error) {
                throw error;
            });

    } else {
        console.error("ERROR UPDATING")
    }
}


async function updateSingleClanMember(interaction, userTag) {

    const clan = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
    if (clan && clan.length) {

        let clanTag = clan[0].clanTag;

        const userResponse = await axios.get(cocApiDomain + '/v1/players/' + routConvert(userTag), config);
        //console.log(userResponse)
        const tag = userResponse.data.tag;
        const name = userResponse.data.name;
        const role = userResponse.data.role;
        const warPreference = userResponse.data.warPreference;
        const userClanTag = userResponse.data.clan.tag;

        if (userClanTag == clanTag) {
            const attackPromise = new Promise((resolve, reject) => {
                db.query("INSERT INTO users (guildId, userTag, userName, userRole, userWarPref) VALUES (" + db.escape(interaction.guildId) + ", " + db.escape(tag) + ", " + db.escape(name) + ", " + db.escape(role) + ", " + db.escape(warPreference) + ") ON DUPLICATE KEY UPDATE userName = " + db.escape(name) + ", userRole = " + db.escape(role) + ", userWarPref = " + db.escape(warPreference) + ";", function (err, result, fields) {
                    if (err) reject(err);
                    else resolve(tag);
                });
            });
            const updatedTag = await attackPromise;
            return;
        }
        else {
            await interaction.editReply({ content: ":x: User is not in this clan anymore", ephemeral: true });
            return;
        }

    } else {
        await interaction.editReply({ content: ":x: That didnt work... do you have a clan linked to this Discord? (/link)", ephemeral: true });
        return;
    }
}
