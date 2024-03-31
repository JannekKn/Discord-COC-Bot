var db = require('./../db');
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);
//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const pre = require("../preset/premade.js");
const of = require("../preset/otherfunctions.js");
const { cocApiToken, cocApiDomain } = require('../config.json');
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };

module.exports = {
    warLog
}

async function warLog(interaction, warDayStartDate) {
    //unser 289URURVJ
    //ander YRCCP980
    //older VPCCPORO

    //get war
    const resultsWars = await query("SELECT * FROM clanwars WHERE guildId = " + interaction.guildId + " AND warStartDay = " + db.escape(warDayStartDate) + ";");

    if (resultsWars && resultsWars.length) {

        const war = resultsWars[0];

        //get members of war
        var resultsWarMembers = await query("SELECT * FROM clanwarmembers WHERE warId = " + db.escape(war.warId) + ";");

        let postChunks = [];
        postChunks.push(":woman_technologist::printer: Clanwar from " + warDayStartDate);
        postChunks.push("\nEnemy: " + war.opponentName + "(" + war.opponentTag + ")");
        postChunks.push("\nWon: " + war.won);
        postChunks.push("\nWar size: " + war.teamSize + "v" + war.teamSize);
        postChunks.push("\nUsed attacks: " + war.clanUsedAttacks + " - " + war.opponentUsedAttacks);
        postChunks.push("\nStars: " + war.clanStars + " - " + war.opponentStars);
        postChunks.push("\nPercentage destroyed: " + war.clanPercentage + " - " + war.opponentPercentage);

        resultsWarMembers.sort((a, b) => a.memberPosition - b.memberPosition);
        //console.log(resultsWarMembers);
        //process the members
        for (let member of resultsWarMembers) {

            //console.log(member)

            //how many attacks did member do
            let attackCount = 0;
            if (member.attack1 != 0) { attackCount++ }
            if (member.attack2 != 0) { attackCount++ }

            //show member in discord Message
            var emote;
            if (attackCount == 2) {
                emote = " :white_check_mark: ";
            }
            else if (attackCount == 1) {
                emote = " :negative_squared_cross_mark: ";
            }
            else {
                emote = " :x: ";
            }
            postChunks.push("\n" + member.memberPosition + "." + emote + " " + attackCount + "/2 " + member.memberName + " (" + member.memberTag + ")");

            let attacks = [];
            attacks.push(member.attack1);
            attacks.push(member.attack2);

            //console.log(attacks);

            //get the attacks from this member
            for (let attackId of attacks) {
                if (attackId != 0) {
                    let resultsAttack = await query("SELECT * FROM clanwarattacks WHERE attackID = " + db.escape(attackId) + ";");
                    //console.log(resultsAttack);
                    let attack = resultsAttack[0];
                    postChunks.push("\n  - " + attack.defenderPosition + ". " + attack.stars + "⭐ (" + attack.destructionPercentage + "%) Enemy: " + attack.defenderName + " (" + attack.defenderTag + ")");
                }
            }
        }

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

        message = 0;
        for (let chunk of chunks) {
            if (message == 0) {
                await interaction.reply({ content: chunk, ephemeral: true });
            } else {
                await interaction.followUp({ content: chunk, ephemeral: true });
            }
            message++;
        }


    } else {
        await interaction.reply({ content: ":x: That warday does not exist!", ephemeral: true });
    }
}