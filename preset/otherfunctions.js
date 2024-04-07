var db = require('./../db');
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);
//Axios for requests
const axios = require('axios');
const { inlineCode, codeBlock } = require('discord.js');
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
    const resultsWars = await query("SELECT * FROM clanwars WHERE isLeague = 0 guildId = " + interaction.guildId + " AND warStartDay = " + db.escape(warDayStartDate) + ";");

    if (resultsWars && resultsWars.length) {

        const war = resultsWars[0];

        //get members of war
        var resultsWarMembers = await query("SELECT * FROM clanwarmembers WHERE warId = " + db.escape(war.warId) + ";");

        let postChunks = [];
        postChunks.push("👩‍💻🖨️ Clanwar from " + warDayStartDate);
        postChunks.push("\n\nOpponent clan: " + war.opponentName + "(" + war.opponentTag + ")");
        postChunks.push("\nWon: " + war.won);
        postChunks.push("\nWar size: " + war.teamSize + "v" + war.teamSize);
        postChunks.push("\nUsed attacks: " + war.clanUsedAttacks + "v" + war.opponentUsedAttacks);
        postChunks.push("\nStars: " + war.clanStars + "v" + war.opponentStars);
        postChunks.push("\nPercentage destroyed: " + war.clanPercentage + "v" + war.opponentPercentage + "\n");

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
                emote = " ✅ ";
            }
            else if (attackCount == 1) {
                emote = " ☑️ ";
            }
            else {
                emote = " ❌ ";
            }
            postChunks.push("\n" + member.memberPosition + "." + emote + attackCount + "/2 " + member.memberName /*+ " (" + member.memberTag + ")"*/);

            let attacks = [];
            attacks.push(member.attack1);
            attacks.push(member.attack2);

            //console.log(attacks);

            //get the attacks from this member
            i = 1;
            for (let attackId of attacks) {
                if (attackId != 0) {
                    let resultsAttack = await query("SELECT * FROM clanwarattacks WHERE attackID = " + db.escape(attackId) + ";");
                    //console.log(resultsAttack);
                    let attack = resultsAttack[0];

                    let starEmoji = "";
                    for (let i = 0; i < attack.stars; i++) {
                        starEmoji += "⭐";
                    }

                    postChunks.push("\n - Attack " + i + " " + starEmoji + " (" + attack.destructionPercentage + "%) on #" + + attack.defenderPosition);
                }
                i++;
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
                await interaction.reply({ content: codeBlock(chunk), ephemeral: true });
            } else {
                await interaction.followUp({ content: codeBlock(chunk), ephemeral: true });
            }
            message++;
        }


    } else {
        await interaction.reply({ content: ":x: That warday does not exist!", ephemeral: true });
    }
}