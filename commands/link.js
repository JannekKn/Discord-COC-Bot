//Discord Slash commands
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
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
		.setName('link')
		.setDescription('Add or remove a link from this Discord server to a coc clan')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a clan to this Discord-Server')
				.addStringOption(option =>
					option.setName('clan-tag')
						.setDescription('The clan tag')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a clan to this Discord-Server')),

	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'add') {
			const clantag = interaction.options.getString('clan-tag');

			const result = await query("SELECT clanTag FROM guildToClan WHERE guildID = " + interaction.guildId + ";");

			if (result && result.length) {
				//guild has a clan connected already!
				await interaction.reply("There is already a clan configured for this server! use /link remove to unlink that one");
			} else {
				//guild has no current clan - linking clan
				//In database
				db.query("INSERT INTO guildToClan (guildID, clanTag) VALUES ('" + interaction.guildId + "', " + db.escape(clantag) + ")", function (err, result, fields) {
					if (err) throw err;
				});

				//get clan info
				axios.get(cocApiDomain + '/v1/clans/' + pre.routConvert(clantag), config)
					.then(async function (response) {
						const clanlinked = new EmbedBuilder()
							.setColor(0x0099FF)
							.setTitle(response.data.name + " (" + clantag + ")")
							.setDescription("Clan successfully linked to this server")
							.setThumbnail(response.data.badgeUrls.small)

						await interaction.reply({ embeds: [clanlinked] });

					})
					.catch(function (error) {
						throw error;
					});
			}
		}
		else if (interaction.options.getSubcommand() === 'remove') {
			//remove link
			await interaction.reply("You are on the way to remove the clan from this Discord Server. If you do this, everything you configured will be deleted! Is that what you want to do?");

			//NOTHING DONE HERE
		}
	},
};

