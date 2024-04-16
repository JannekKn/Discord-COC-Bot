//Discord Slash commands
const { SlashCommandBuilder, bold } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('calculate')
		.setDescription('Calculate building times')

		.addSubcommand(subcommand =>
			subcommand
				.setName('builders-potion')
				.setDescription('calculate time for use with the builders-potion')
				/*.addIntegerOption(option =>
					option.setName('gems')
						.setDescription('how many gems does your upgrade cost to finish')
						.setRequired(true)))*/
				.addIntegerOption(option =>
					option.setName('days')
						.setDescription('how many gems does your upgrade cost to finish'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('hours')
						.setDescription('hours left of ur upgrade'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('minutes')
						.setDescription('minutes left of ur upgrade')))
		//.setRequired(true)))

		.addSubcommand(subcommand =>
			subcommand
				.setName('clock-tower-potion')
				.setDescription('calculate time for use with the clock-tower')
				.addIntegerOption(option =>
					option.setName('days')
						.setDescription('how many gems does your upgrade cost to finish'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('hours')
						.setDescription('hours left of ur upgrade'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('minutes')
						.setDescription('minutes left of ur upgrade')))
		//.setRequired(true)))

		.addSubcommand(subcommand =>
			subcommand
				.setName('lab-potion')
				.setDescription('calculate time for use with the lab-potion')
				.addIntegerOption(option =>
					option.setName('days')
						.setDescription('how many gems does your upgrade cost to finish'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('hours')
						.setDescription('hours left of ur upgrade'))
				//.setRequired(true))
				.addIntegerOption(option =>
					option.setName('minutes')
						.setDescription('minutes left of ur upgrade'))),
	//.setRequired(true))),

	async execute(interaction) {
		//gems to time calculator
		/*var gems = interaction.options.getInteger('gems');
		var time = 0;
		while(gems > 0) {
			if(gems >= 1000) {
				gems = gems - 1000;
				time = time + 10080;
			}
			else if(gems >= 260) {
				gems = gems - 260;
				time = time + 1440;
			}
			else if(gems >= 20) {
				gems = gems - 20;
				time = time + 60;
			}
			else {
				gems = gems - 1;
				time = time + 1;
			}
		}
		console.log(time);*/

		days = interaction.options.getInteger('days');
		if (days == "") { days = 0; }
		hours = interaction.options.getInteger('hours');
		if (hours == "") { hours = 0; }
		mins = interaction.options.getInteger('minutes');
		if (mins == "") { mins = 0; }

		var time = (days * 24 * 60) + (hours * 60) + mins;

		if (interaction.options.getSubcommand() === 'builders-potion') {
			if (time >= 600) {
				time = time - 540;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
			else {
				time = time * 0.1;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
		}

		else if (interaction.options.getSubcommand() === 'clock-tower-potion') {
			if (time >= 300) {
				time = time - 270;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
			else {
				time = time * 0.1;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
		}

		else if (interaction.options.getSubcommand() === 'lab-potion') {
			if (time >= 1440) {
				time = time - 1380;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
			else {
				time = time / 24;

				days = Math.floor(time / 1440);
				hours = Math.floor((time % 1440) / 60);
				minutes = (time % 1440) % 60;

				await interaction.reply({ content: "Time left: " + bold(days + " days " + hours + " hours " + minutes + " minutes"), ephemeral: true });
			}
		}

	},
};