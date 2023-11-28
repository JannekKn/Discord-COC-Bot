//Discord Slash commands
const { SlashCommandBuilder, bold } = require('discord.js');
//Axios for requests
const axios = require('axios');
//Coc api Token and domain values
const { cocApiToken, cocApiDomain } = require('../config.json');
//Database file
var db = require('../db');
//Config for api request
const config = {headers: {Authorization: `Bearer ${cocApiToken}`}};
//imports premade functions 
const pre = require("../preset/premade.js");
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('member-set')
		.setDescription('Set a specific status for a member of the clan')

		.addSubcommand(subcommand =>
			subcommand
				.setName('activity')
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
				.setName('comment')
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
				.setName('war')
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
						))),

	async autocomplete(interaction) {
		pre.autoCompleteUsers(interaction, interaction.guildId, interaction.options.getFocused());
	},

	async execute(interaction) {

		if (interaction.options.getSubcommand() === 'activity') {
			const member = interaction.options.getString('member');
			const activity = interaction.options.getString('activity-level');
			const result = await query("SELECT userName FROM users WHERE guildId = "+interaction.guildId+" AND userName LIKE " + db.escape(member) + ";");

			if (result && result.length ) {
				
				db.query("UPDATE users SET activity = " + db.escape(activity) + " WHERE userName = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.reply({content: ":white_check_mark: The activity-Status for " + bold(member) + " got changed to: " + bold(activity), ephemeral: true});
				
			} else {
				await interaction.reply({content: ":x: That user does not exist! Nothing changed", ephemeral: true});
			}
		}

		else if (interaction.options.getSubcommand() === 'comment') {
			const member = interaction.options.getString('member');
			const comment = interaction.options.getString('comment');

			const result = await query("SELECT userName FROM users WHERE guildId = "+interaction.guildId+" AND userName LIKE " + db.escape(member) + ";");

			if (result && result.length ) {
				
				db.query("UPDATE users SET userComment = " + db.escape(comment) + " WHERE userName = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.reply({content: ":white_check_mark: The comment for " + bold(member) + " got changed to:\n" + bold(comment), ephemeral: true});
				
			} else {
				await interaction.reply({content: ":x: That user does not exist! Nothing changed", ephemeral: true});
			}
		}

		else if (interaction.options.getSubcommand() === 'war') {
			const member = interaction.options.getString('member');
			const preference = interaction.options.getString('preference');

			const result = await query("SELECT userName FROM users WHERE guildId = "+interaction.guildId+" AND userName LIKE " + db.escape(member) + ";");

			if (result && result.length ) {
				
				db.query("UPDATE users SET userCustomWar = " + db.escape(preference) + " WHERE userName = " + db.escape(member) + " AND guildId = '" + interaction.guildId + "';", function (err, result, fields) {
					if (err) throw err;
				});

				await interaction.reply({content: ":white_check_mark: The custom war preference for " + bold(member) + " got changed to: " + bold(preference), ephemeral: true});
				
			} else {
				await interaction.reply({content: ":x: That user does not exist! Nothing changed", ephemeral: true});
			}
		}

	},
};

