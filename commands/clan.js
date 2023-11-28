//Discord Slash commands
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain } = require('../config.json');
//Database file
var db = require('../db');
//Config for api request
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };
//imports premade functions 
const pre = require("../preset/premade.js");
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);



module.exports = {
	data: new SlashCommandBuilder()
		.setName('clan')
		.setDescription('View or update your clan info')

		.addSubcommand(subcommand =>
			subcommand
				.setName('update')
				.setDescription('update the list of members in the clan (remove, add, update clan war status, etc.)'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('view your clan manually'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('capital-raids')
				.setDescription('view who attacks in capital raids and who does not')),

	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'update') {
			await interaction.deferReply();
			await interaction.editReply(':arrows_clockwise: Updating... ');
			await pre.updateClanMembers(interaction);
			interaction.editReply(':white_check_mark: Info of clan-members sucesfully updated!');
		}

		else if (interaction.options.getSubcommand() === 'list') {
			await interaction.deferReply();
			await interaction.editReply(':arrows_clockwise: Updating... ');
			await pre.updateClanMembers(interaction);

			const clan = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
			if (clan && clan.length) {

				const users = await query('SELECT userName, userComment, userWarPref, userCustomWar, activity FROM users WHERE guildID = ' + interaction.guildId + ' ORDER BY userName');

				if (users && users.length) {

					//get clan info
					axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clan[0].clanTag), config)
						.then(async function (response) {

							await interaction.editReply({ content: "Here you go!", ephemeral: true });

							const clanlist = new EmbedBuilder()
								.setColor(0x0099FF)
								.setTitle(response.data.name)
								.setDescription("List of all the members in the clan")
								.setThumbnail(response.data.badgeUrls.small);

							const clanlist2 = new EmbedBuilder()
								.setColor(0x0099FF)

							var counter = 0;
							for (let item of users) {
								var memberString = "";

								//war in/out (custom)
								if (item.userWarPref == "out") { memberString += ":x:"; }
								else if (item.userWarPref == "in" && item.userCustomWar == "out") { memberString += ":warning:"; }
								else if (item.userWarPref == "in" && item.userCustomWar == "in") { memberString += ":white_check_mark:"; }

								//name
								memberString += " " + item.userName + " ";

								//activity
								if (item.activity == "yes") { memberString += ":thumbsup:"; }
								else if (item.activity == "semi") { memberString += ":ok_hand:"; }
								else if (item.activity == "no") { memberString += ":thumbsdown:"; }

								var comment = " ";
								if (item.userComment != null) {
									comment += item.userComment;
								}

								if (counter < 25) {
									clanlist.addFields({ name: memberString, value: comment, inline: true });
								}
								else {
									clanlist2.addFields({ name: memberString, value: comment, inline: true });
								}

								counter++;

							}

							await interaction.editReply({ embeds: [clanlist, clanlist2] });

						})
				} else {
					await interaction.editReply({ content: ":x: Currently there is no data for your clan! Try to update it first with /clan update", ephemeral: true });
				}

			} else {
				await interaction.editReply({ content: ":x: That didnt work... do you have a clan linked to this Discord? (/link)", ephemeral: true });
			}

		}

		else if (interaction.options.getSubcommand() === 'capital-raids') {
			await interaction.deferReply({ephemeral: true});
			await interaction.editReply({ content: ":arrows_clockwise: Updating... ", ephemeral: true });
			await pre.updateClanMembers(interaction);

			const clan = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
			if (clan && clan.length) {

				let clanTag = clan[0].clanTag;

				const attacks = await query('SELECT memberTag, memberName, SUM(CASE WHEN attacked = 1 THEN 1 ELSE 0 END) AS actualAttacks, COUNT(*) AS possibleAttacks FROM capitalRaids WHERE clanTag = ' + db.escape(clanTag) + ' AND guildID = ' + db.escape(interaction.guildId) + ' GROUP BY memberTag, memberName ORDER BY memberName;');


				if (attacks && attacks.length) {
					var membersString = ":thinking: Here is your list of how often people attack in the last capital raids: \n"
                    membersString += "```";
                    for (let item of attacks) {
                        membersString += item.actualAttacks + "/" + item.possibleAttacks + " " + item.memberName + " (" + item.memberTag + ")\n";
                    }
                    membersString += "```";
					await interaction.editReply({ content: membersString, ephemeral: true });

				} else {
					await interaction.editReply({ content: ":x: There is no data für your clan, play some raid weekends/capital raids and then try again afterwards", ephemeral: true });
				}


			} else {
				await interaction.editReply({ content: ":x: That didnt work... do you have a clan linked to this Discord? (/link)", ephemeral: true });
			}

		}
	},
};
