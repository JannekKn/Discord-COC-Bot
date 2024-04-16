//Discord Slash commands
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ApplicationCommandPermissionType, EmbedBuilder, bold, inlineCode, codeBlock } = require('discord.js');
//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain } = require('../config.json');
//Database file
var db = require('../db.js');
//Config for api request
const config = { headers: { Authorization: `Bearer ${cocApiToken}` } };
//imports premade functions 
const pre = require("../preset/premade.js");
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('member')
		.setDescription('Set a specific status for a member of the clan')

		.addSubcommand(subcommand =>
			subcommand
				.setName('set-activity')
				.setDescription('Set how active a member of the clan is')
				.addStringOption(option =>
					option.setName('member')
						.setDescription('the effectet member')
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('activity-level')
						.setDescription('how active is this member')
						.setRequired(true)
						.addChoices(
							{ name: 'yes', value: 'yes' },
							{ name: 'semi', value: 'semi' },
							{ name: 'no', value: 'no' },
							{ name: 'unknown', value: 'unknown' },
						)))

		.addSubcommand(subcommand =>
			subcommand
				.setName('set-comment')
				.setDescription('Set a comment for a member in the clan')
				.addStringOption(option =>
					option.setName('member')
						.setDescription('the effectet member')
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('comment')
						.setDescription('comment for the user')
						.setMaxLength(125)
						.setRequired(true)))

		.addSubcommand(subcommand =>
			subcommand
				.setName('set-war')
				.setDescription('Set a custom in/out for members if they should be in wars or not')
				.addStringOption(option =>
					option.setName('member')
						.setDescription('the effectet member')
						.setAutocomplete(true)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('preference')
						.setDescription('should this member be in or out of wars')
						.setRequired(true)
						.addChoices(
							{ name: 'in', value: 'in' },
							{ name: 'out', value: 'out' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('info')
				.setDescription('Get all info about a specific member')
				.addStringOption(option =>
					option.setName('member')
						.setDescription('the effectet member')
						.setAutocomplete(true)
						.setRequired(true))),

	async autocomplete(interaction) {
		pre.autoCompleteUsers(interaction, interaction.guildId, interaction.options.getFocused());
	},

	async execute(interaction) {

		if (interaction.options.getSubcommand() === 'set-activity') {
			const member = interaction.options.getString('member');
			const activity = interaction.options.getString('activity-level');
			const result = await query("SELECT userName FROM users WHERE guildId = " + interaction.guildId + " AND userTag = " + db.escape(member) + ";");

			if (result && result.length) {

				db.query("UPDATE users SET activity = " + db.escape(activity) + " WHERE userTag = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.editReply({ content: ":white_check_mark: The activity-Status for " + bold(member) + " got changed to: " + bold(activity), ephemeral: true });

			} else {
				await interaction.editReply({ content: ":x: That user does not exist! Nothing changed", ephemeral: true });
			}
		}

		else if (interaction.options.getSubcommand() === 'set-comment') {
			const member = interaction.options.getString('member');
			const comment = interaction.options.getString('comment');

			const result = await query("SELECT userName FROM users WHERE guildId = " + interaction.guildId + " AND userTag = " + db.escape(member) + ";");

			if (result && result.length) {

				db.query("UPDATE users SET userComment = " + db.escape(comment) + " WHERE userName = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.editReply({ content: ":white_check_mark: The comment for " + bold(member) + " got changed to:\n" + bold(comment), ephemeral: true });

			} else {
				await interaction.editReply({ content: ":x: That user does not exist! Nothing changed", ephemeral: true });
			}
		}

		else if (interaction.options.getSubcommand() === 'set-war') {
			const member = interaction.options.getString('member');
			const preference = interaction.options.getString('preference');

			const result = await query("SELECT userName FROM users WHERE guildId = " + interaction.guildId + " AND userTag = " + db.escape(member) + ";");

			if (result && result.length) {

				db.query("UPDATE users SET userCustomWar = " + db.escape(preference) + " WHERE userName = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.editReply({ content: ":white_check_mark: The custom war preference for " + bold(member) + " got changed to: " + bold(preference), ephemeral: true });

			} else {
				await interaction.editReply({ content: ":x: That user does not exist! Nothing changed", ephemeral: true });
			}
		}



		else if (interaction.options.getSubcommand() === 'info') {
			const tag = interaction.options.getString('member');

			await interaction.deferReply();
			await interaction.editReply(':arrows_clockwise: Updating... ');
			await pre.updateSingleClanMember(interaction, tag);


			const user = await query(`SELECT * FROM users WHERE userTag = '${tag}' AND guildId = '${interaction.guildId}';`);
			if (user && user.length) {
				const thisUser = user[0];

				let postChunks = [];

				// Function to add default user info
				function addDefaultUserInfo() {
					postChunks.push("User " + thisUser.userName + " Info:");
					postChunks.push("\n\nTag: " + thisUser.userTag);
					postChunks.push("\nRole: " + thisUser.userRole);
					postChunks.push("\nWar preference: " + thisUser.userWarPref);
					postChunks.push("\nCustom war preference: " + thisUser.userCustomWar);
					postChunks.push("\nComment: " + (thisUser.userComment ? thisUser.userComment : "-"));
					postChunks.push("\nActivity: " + thisUser.activity);
				}

				// Function to add capital raids info
				async function addCapitalRaidsInfo() {
					postChunks.push("\n\nRaid Weekends:");

					const capRaids = await query(`SELECT * FROM capitalRaids WHERE memberTag = '${tag}' AND guildID = '${interaction.guildId}' ORDER BY timeAdded DESC;`);
					if (capRaids && capRaids.length) {
						//All together
						var actualAttacks = 0;
						var possibleWeeks = 0;
						for (let raid of capRaids) {
							actualAttacks += raid.attacked;
							possibleWeeks++;
						}
						postChunks.push("\nAll " + possibleWeeks + " weeks: " + actualAttacks + "/" + possibleWeeks * 6);

						//last few
						var amount = 5;
						let weekCounter = 1;
						for (var i = 0; i < Math.min(amount, capRaids.length); i++) {
							let oneRaid = capRaids[i];
							postChunks.push("\n" + weekCounter + ". " + oneRaid.attacked + "/6");
							weekCounter++;
						}
					} else {
						postChunks.push("\nNo Raid Weekends found for this user");
					}
				}

				// Function to add clan wars info
				async function addClanWarsInfo() {
					postChunks.push("\n\nClan wars:");

					const wars = await query(`SELECT cm.* FROM clanwarmembers AS cm JOIN clanwars AS cw ON cm.warId = cw.warId WHERE cm.memberTag = '${tag}' AND cw.guildID = '${interaction.guildId}' ORDER BY cm.warId DESC;`);
					if (wars && wars.length) {
						//All together
						var attacks = 0;
						var inWars = 0;
						var attackData = [];
						for (let war of wars) {
							if (war.attack1 != 0) {
								attacks++;
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + war.attack1 + ';');
								attackData.push(attack[0]);
							}
							if (war.attack2 != 0) {
								attacks++;
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + war.attack2 + ';');
								attackData.push(attack[0]);
							}
							inWars++;
						}

						//calc
						let totalStars = 0;
						let totalPercentage = 0;
						for (let oneAttack of attackData) {
							totalStars += oneAttack.stars;
							totalPercentage += oneAttack.destructionPercentage;
						}
						let avgStars = totalStars / attacks;
						let avgPercentage = totalPercentage / attacks;

						postChunks.push("\nAll " + inWars + " wars:\nAttacked: " + attacks + "/" + inWars * 2 + "\nAvg. stars: " + avgStars + "\nAvg. Percentage: " + avgPercentage + "%");

						//last few
						amount = 8;
						let attackCounter = 1;
						for (var i = 0; i < Math.min(amount, wars.length); i++) {
							//this is double now, i know, but im too lazy to fix it now, maybe later @TODO
							let oneWar = wars[i];
							if (oneWar.attack1 != 0) {
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + oneWar.attack1 + ';');
								let thisAttack = attack[0];
								let starEmoji = "";
								for (let i = 0; i < thisAttack.stars; i++) {
									starEmoji += "⭐";
								}
								postChunks.push("\n" + attackCounter + ". ✔️ " + starEmoji + " " + thisAttack.destructionPercentage + "%");
							} else {
								postChunks.push("\n" + attackCounter + ". ❌");
							}
							attackCounter++;

							if (oneWar.attack2 != 0) {
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + oneWar.attack2 + ';');
								let thisAttack = attack[0];
								let starEmoji = "";
								for (let i = 0; i < thisAttack.stars; i++) {
									starEmoji += "⭐";
								}
								postChunks.push("\n" + attackCounter + ". ✔️ " + starEmoji + " " + thisAttack.destructionPercentage + "%");
							} else {
								postChunks.push("\n" + attackCounter + ". ❌");
							}
							attackCounter++;
						}
					} else {
						postChunks.push("\nNo Clan wars found for this user");
					}
				}

				// Function to add clan war league info
				async function addClanWarLeagueInfo() {
					postChunks.push("\n\nClan war league:");

					const warsleague = await query(`SELECT cm.* FROM clanwarleaguemembers AS cm JOIN clanwars AS cw ON cm.warId = cw.warId WHERE cm.memberTag = '${tag}' AND cw.guildID = '${interaction.guildId}' ORDER BY cm.warId DESC;`);

					if (warsleague && warsleague.length) {
						//All together
						var attacks = 0;
						var inWars = 0;
						var attackData = [];
						for (let war of warsleague) {
							if (war.attack != 0) {
								attacks++;
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + war.attack + ';');
								attackData.push(attack[0]);
							}
							inWars++;
						}

						//calc
						let totalStars = 0;
						let totalPercentage = 0;
						for (let oneAttack of attackData) {
							totalStars += oneAttack.stars;
							totalPercentage += oneAttack.destructionPercentage;
						}
						let avgStars = totalStars / attacks;
						let avgPercentage = totalPercentage / attacks;

						postChunks.push("\nAll " + inWars + " wars:\nAttacked: " + attacks + "/" + inWars + "\nAvg. stars: " + avgStars + "\nAvg. Percentage: " + avgPercentage + "%");

						//last few
						amount = 7;
						let attackCounter = 1;
						for (var i = 0; i < Math.min(amount, warsleague.length); i++) {
							//this is double now, i know, but im too lazy to fix it now, maybe later @TODO
							let oneWar = warsleague[i];
							if (oneWar.attack != 0) {
								let attack = await query('SELECT * FROM clanwarattacks WHERE attackID = ' + oneWar.attack + ';');
								let thisAttack = attack[0];
								let starEmoji = "";
								for (let j = 0; j < thisAttack.stars; j++) {
									starEmoji += "⭐";
								}
								postChunks.push("\n" + attackCounter + ". ✔️ " + starEmoji + " " + thisAttack.destructionPercentage + "%");
							} else {
								postChunks.push("\n" + attackCounter + ". ❌");
							}
							attackCounter++;
						}
					} else {
						postChunks.push("\nNo Clan war leagues found for this user");
					}
				}

				// Add info using functions
				addDefaultUserInfo();
				await addCapitalRaidsInfo();
				await addClanWarsInfo();
				await addClanWarLeagueInfo();


				const chunks = [];
				const maxLength = 1900;
				let currentChunk = '';
				const forceNewChunkMarker = "!!!FORCE_NEW_CHUNK!!!"; // Unique, unlikely content

				postChunks.forEach(line => {
					if ((currentChunk + line).length <= maxLength && !line.includes(forceNewChunkMarker)) {
						currentChunk += line;
					} else {
						chunks.push(currentChunk.trim());
						currentChunk = line.includes(forceNewChunkMarker) ? '' : line; // Reset chunk only if marker not found
					}
				});

				// Handle remaining chunk (if any)
				if (currentChunk.length > 0) {
					chunks.push(currentChunk.trim());
				}

				let message = 0;
				for (const chunk of chunks) {
					if (message === 0) {
						//console.log("replied");
						await interaction.editReply({ content: codeBlock(chunk), ephemeral: true });
					} else {
						//console.log("followup");
						await interaction.followUp({ content: codeBlock(chunk), ephemeral: true });
					}
					message++;
				}
			}
			else {
				console.error("Something went wrong somewhere, person is in clan but somehow not in the clan list, even if it updated")
				await interaction.editReply({ content: ":x: Something went wrong somewhere, person is in clan but somehow not in the clan list, even if it updated. maybe try updating the clan manually", ephemeral: true });
			}
		}

	},
};

