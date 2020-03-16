const Eris = require('eris')
const glob = require('glob')
const path = require('path')

let auth = require('./auth.json')
let prefix = auth.prefix
let botModules = {}

glob.sync('./bot_modules/*.js').forEach( file => {
	let script = require( path.resolve( file ) )
	botModules[script.name] = script
})

let reactionModules = Object.values(botModules).filter( o => o.event == "MESSAGE_REACTION_ADD" )
let commandModules = Object.values(botModules).filter( o => o.event == "MESSAGE_CREATE" )

let bot = new Eris( auth.token , {
	disableEveryone: true,
	getAllUsers: false,
	restMode: false,
})

bot.connect()


bot.on('ready', async () => {
	
	let myAltID = bot.user.id
	let otherGuilds = bot.guilds.filter( g => g.ownerID != myAltID )
	let cacheGuilds = bot.guilds.filter( g => g.ownerID == myAltID )
	
    console.log(`\n[Puzzle] Logged into ${bot.guilds.size} total guilds as ${bot.user.username} - ${bot.user.id}\n`)
	console.log(otherGuilds.map( g => `${g.id} : ${g.name} : ${g.memberCount} members`))
	
	console.log("\n\nPuzzle Cache:\n")
	console.log(cacheGuilds.map( x => `Cache ${x.name.replace("!puzzle:","")} : ${x.emojis.length} emojis` ))
	
	bot.editStatus("online", { name: `${prefix}puzzle` })
})

bot.on('messageReactionAdd', async (reactionMessage, emoji, userID) => {
	if (bot.users.get(userID).bot) return // bot check (includes self)
		
	for (botModule of reactionModules){
		await botModule.run(bot, null, null, reactionMessage, emoji, userID)
	}
})

bot.on('messageCreate', async (message) => {
	if (!message.channel.guild || !message.author || !message.member) return // DM check, bot check, webhook check
	if (message.author.bot) return // bot check
	
	if (message.content.startsWith(prefix)){
		let command = message.content.split(" ")[0].slice(prefix.length)
		let botModule = commandModules.find( c => c.name == command )
		
		if (botModule) {
			let moduleStatus = await botModule.run(bot, message, null, null)
			
			if (moduleStatus) {
				console.log(`[Puzzle][x] ${prefix}${botModule.name}: ${message.author.username} @ @ ${message.channel.guild.name}`)
				message.addReaction("❌")
			} else {
				console.log(`[Puzzle] ${prefix}${botModule.name}: ${message.author.username} @ ${message.channel.guild.name}`)
			}
		}
	}
})

bot.on('guildCreate', (guild) => {
	console.log(`[Puzzle] Joined a new guild ${guild.name} : ${guild.memberCount}`)
})

bot.on('guildDelete', (guild) => {
	console.log(`[Puzzle] Left ${guild.name} : ${guild.memberCount}`)
})

bot.on('disconnect', (error) => {
	console.log(`[Puzzle] Disconnected with error ${error}. Reconnecting...`)
})

process.on('uncaughtException', function(err) {
    console.log('[!] Uncaught Exception: ', err)
})

process.on('unhandledRejection', (reason, promise) => {
	console.log('[!] Unhandled Rejection at:', reason.stack || reason)
})