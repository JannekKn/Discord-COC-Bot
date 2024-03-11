var db = require('./db.js');
const util = require('util');
// node native promisify
const query = util.promisify(db.query).bind(db);


const fs = require('node:fs');
const path = require('node:path');
const { ActivityType, Client, Collection, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, () => {
	console.log('Bot is ready on Discord!');
	client.user.setActivity("for Coc's", { type: ActivityType.Watching });

	const scheduled = require('./scheduled.js');
	scheduled.start(client);
});

/*client.on('guildMemberAdd', member => {
	member.guild.channels.get('channelID').send("CoCBot joined the Server, try /commands from this bot to see the commands"); 
	deploy();
});*/

client.on('disconnect', (event) => {
	console.error(`Disconnected: ${event.reason} (${event.code})`);
	// Attempt to reconnect after delay
	setTimeout(() => {
		console.log(`Trying to connect again...`);
		client.login(token);
	}, 5000);
});

client.on('interactionCreate', async interaction => {
	if (interaction.isChatInputCommand()) {
		const command = client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			//await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	} else if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error(error);
		}
	}
});

console.log(`Trying to connect`);
client.login(token);



async function keepDatabaseAlive() {
	const rows = await query('SELECT 1;');
	console.log("Kept Database alive");
}
//required for my own database, if you dont need this, you can delete it.should have no impact on performance
setInterval(keepDatabaseAlive, 1 * 60 * 60 * 1000);