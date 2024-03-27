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
const of = require("../preset/otherfunctions.js");
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('war')
        .setDescription('anything about clanwars')

        .addSubcommand(subcommand =>
            subcommand
                .setName('list-potential')
                .setDescription('list all members that are on green and are set on in by the bot'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('log')
                .setDescription('Get war log of a specific clanwar')
                .addStringOption(option =>
                    option.setName('war-start-day')
                        .setDescription('date of the day where the attacking phase started')
                        .setAutocomplete(true)
                        .setRequired(true))),

    async autocomplete(interaction) {
        pre.autoCompleteWarDates(interaction, interaction.guildId, interaction.options.getFocused());
    },

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'list-potential') {

            await interaction.deferReply();
            await interaction.editReply(':arrows_clockwise: Updating... ');
            await pre.updateClanMembers(interaction)

            const clan = await query('SELECT clanTag FROM guildToClan WHERE guildID = ' + interaction.guildId);
            if (clan && clan.length) {

                const users = await query('SELECT userName FROM users WHERE guildID = ' + interaction.guildId + ' AND userWarPref = "in" AND userCustomWar = "in" ORDER BY userName');

                if (users && users.length) {

                    var membersString = ":crossed_swords: List of all members that are on green and set to in by this bot: \n"
                    membersString += "```";
                    for (let item of users) {
                        membersString += item.userName + "\n";
                    }
                    membersString += "```";

                    await interaction.editReply(membersString);


                } else {
                    await interaction.editReply({ content: ":x: Currently there is no data for your clan! Try to update it first with /clan update", ephemeral: true });
                }

            } else {
                await interaction.editReply({ content: ":x: That didnt work... do you have a clan linked to this Discord? (/link)", ephemeral: true });
            }

        }
        else if (interaction.options.getSubcommand() === 'log') {
            
            const warDayDate = interaction.options.getString('war-start-day');
            of.warLog(interaction, warDayDate);
        }
    },
};

