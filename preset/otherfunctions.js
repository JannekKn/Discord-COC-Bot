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

    const results = await query("SELECT memberTag, memberName, attackCount FROM clanwars WHERE guildId = " + interaction.guildId + " AND warStartDay = " + db.escape(warDayStartDate) + ";");

    if (results && results.length) {
        console.log(results)
        console.log(results[1].memberTag)
        let postChunks = [];
        postChunks.push(":woman_technologist::printer: Clanwar from " + warDayStartDate);

        i = 1;
        for (let member of results) {
            console.log(member)
            console.log(member.memberTag, member.memberName, member.attackCount);
            var emote;
            if(member.attackCount > 0) {
                emote = " :white_check_mark: ";
            } else {
                emote = " :x: ";
            }
            //console.log(i + "." + emote + " " + member.attackCount + "/2 " + member.memberName + " (" + member.memberTag + ")")
            postChunks.push("\n" + i + "." + emote + " " + member.attackCount + "/2 " + member.memberName + " (" + member.memberTag + ")");
            i++;
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
            if(message == 0) {
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