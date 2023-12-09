var db = require('./../db');
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);
//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain } = require('../config.json');
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };

module.exports = {
    autoCompleteUsers,
    routConvert,
    updateClanMembers,
    delay
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
} 

async function autoCompleteUsers(interaction, guildId, value) {
    var userinput = db.escape('%' + value + '%');
    const users = await query("SELECT userName FROM users WHERE guildId = " + db.escape(guildId) + " AND userName LIKE " + userinput + ";");

    //Put all users into Array
    let userArray = [];
    for (let item of users) {
        userArray.push(item.userName);
    }

    //If there are more than 25 options, do nothing, becuase discord is stupid
    if (userArray.length <= 25) {
        await interaction.respond(
            userArray.map(choice => ({ name: choice, value: choice })),
        );
    } else {
        await interaction.respond();
    }
}

function routConvert(stringWithRout) {
    return stringWithRout.replace("#", "%23");
}

async function updateClanMembers(interaction) {

    const rows = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
    if (rows && rows.length) {
        const clantag = rows[0].clanTag;

        //Array where all clan Tags get added
        var userTags = [];

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

                    // Update that info if needed
                    return new Promise((resolve, reject) => {
                        db.query("INSERT INTO users (guildId, userTag, userName, userRole, userWarPref) VALUES (" + db.escape(interaction.guildId) + ", " + db.escape(tag) + ", " + db.escape(name) + ", " + db.escape(role) + ", " + db.escape(warPreference) + ") ON DUPLICATE KEY UPDATE userName = " + db.escape(name) + ", userRole = " + db.escape(role) + ", userWarPref = " + db.escape(warPreference) + ";", function (err, result, fields) {
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
        console.log("ERROR UPDATING")
    }
}
