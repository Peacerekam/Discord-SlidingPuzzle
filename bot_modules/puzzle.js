//const fs = require('fs')
//const {execFile} = require('child_process')
//const gifsicle = require('gifsicle')
const rimraf = require("rimraf")
const glob = require('glob')

var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))

var Jimp = require("jimp")
var writeFileAtomic = require('write-file-atomically')
var rp = require('request-promise').defaults({ encoding: null })
var request = require('request').defaults({ encoding: null })

let savedPuzzles = require('../puzzles.json')

//var currentPos = { x: 2, y: 2 }
//var mapDimensions = { x: 4, y: 4 }

let activePuzzles = {}
let setupMsgs = {}

let randomPictures = [ 
	"https://cdn.discordapp.com/attachments/282208855289495554/676511520066109446/Echidna.png", 
	"https://cdn.discordapp.com/attachments/282208855289495554/681301091601612850/76227152_p0.jpg", 
	"https://cdn.discordapp.com/attachments/282208855289495554/681301116268576783/09cb190bd1cb6c86d63cae8d2959ed9d.png",
	"https://cdn.discordapp.com/attachments/282208855289495554/681301113659850779/7adc287488555a6d9a673a81f63323c4.jpg",
	"https://cdn.discordapp.com/attachments/282208855289495554/681301112447696896/image0.jpg",
	"https://cdn.discordapp.com/attachments/658364853999763466/681256266206543890/ferris.gif",
	"https://cdn.discordapp.com/attachments/658364853999763466/681890931372589070/15824355530265887536554335253.png",
	"https://cdn.discordapp.com/attachments/191709045646688256/679101658181009460/17c3bd84967fdc0849b7fbde3e7c3bae.png",
	"https://cdn.discordapp.com/attachments/406969205661892611/678239317071495168/79483046_p0.png"
]

module.exports = {
	name: "puzzle",
	event: "MESSAGE_CREATE",
	desc: "**[g]** shows Sliding Puzzle usage",
	run: async (bot, message, guilds, stats) => {
		
		try {
			
			let words = message.content.split(" ")
			
			if (words[1]){
				
				if (words[1] == "random"){
					
					// ok
					
				} else if (words[1] == "yeet"){
					
					if (message.author.id != "153942038138585088") return
					
					bot.guilds.forEach( async (g) => {
						if (g.ownerID == bot.user.id){
							console.log(g.id)
							await g.delete()
							console.log("left...")
						}
					})
					
					await message.channel.createMessage("done(-ish)")
					return
					
				} else {
					
					if (words[1].startsWith("<") && words[1].endsWith(">")){ 
						words[1] = words[1].slice(1, words[1].length - 1)
					}
					
					let isImg = await checkURLforImage(words[1])
					
					if (!isImg){
						await message.channel.createMessage(">>> <@" + message.author.id + ">\nInvalid URL provided!")
						//throw new Error("invalid image URL provided")
						return
					}
					
				}
				
			} else {
				await message.channel.createMessage("```md\n# Sliding Puzzle usage:\n" + 
													"d?puzzle            shows this message\n" +
													"d?puzzle URL x      creates puzzle from URL with specified shuffle (x)\n" +
													"d?puzzle URL        -||- but default shuffle amount to 20\n" +
													"d?puzzle random x   picks random picture with specified shuffle\n" +
													"d?puzzle random     -||- but default shuffle amount to 20\n\n" +
													"> examples:\n" +
													"d?puzzle random\n" +
													"d?puzzle random 5\n" +
													"d?puzzle https://i.imgur.com/XuFOQWr.png\n" +
													"d?puzzle https://i.imgur.com/XuFOQWr.png 12\n```"
													)
				return
			}
			
			
			
			let reply = await message.channel.createMessage(">>> <@" + message.author.id + ">\nSelect grid size (``3x3``, ``4x4``, ``5x5``):")
			
			setupMsgs[reply.id] = message
			
			let reactions = [ "3️⃣", "4️⃣", "5️⃣" ]
			for (r of reactions) await reply.addReaction(r)
			
			setTimeout( async() => {
				
				// automatically time out the command after 10 seconds
				if (setupMsgs[reply.id]){
					delete setupMsgs[reply.id]
					
					await reply.removeReactions()
					await reply.edit(">>> <@" + message.author.id + ">\nCommand timed out (``30 seconds``)")
				}
				
			}, 30000 ) // 300000 ms = 5 mins
		
		} catch (e){
			console.log("[Puzzle] initial message error: ", e.message )
		}
		
	},
	generate: async (bot, message, guilds, stats, gridSize) => {
		
		let reply
		let reply2 
		
		try {
			
			let words = message.content.split(" ")
			let url = null
			
			if (words[1]){
				
				if (words[1] == "random"){
					
					let r = Math.floor(Math.random() * randomPictures.length)
					url = randomPictures[r]
					
					reply = await bot.createMessage( message.channel.id, workingOnIt(message.author.id) )
					reply2 = await message.channel.createMessage({ embed: { description: "​"} })
					await reply2.edit({ flags: (1 << 2) })
					
				} else {
					
					if (words[1].startsWith("<") && words[1].endsWith(">")){ 
						words[1] = words[1].slice(1, words[1].length - 1)
					}
					
					reply = await bot.createMessage( message.channel.id, workingOnIt(message.author.id) )
					reply2 = await message.channel.createMessage({ embed: { description: "​"} })
					await reply2.edit({ flags: (1 << 2) })
					
					let isImg = await checkURLforImage(words[1])
					
					if (isImg){
						url = words[1]
					} else {
						throw new Error("invalid image URL provided")
						return
					}
				
				}
			
			} else {
				// this should never happen unless someone edits the message
				return
			}
			
			url = optimizeDiscordUrl(url)
			let lenna = await Jimp.read(url)
			
			let mapDimensions = {
				x: gridSize,
				y: gridSize
			}
			
			let puzzleBlocks = mapDimensions.x
			let pictureSize =  48 * puzzleBlocks // 240  // 240x240 
			let blockSize = Math.floor(pictureSize / puzzleBlocks ) // 48x48
			
			await lenna.cover(pictureSize, pictureSize)
			
			let dummyGuildName = `!puzzle:${puzzleBlocks}x${puzzleBlocks}-${lenna.hash()}`
			let dummyGuild = bot.guilds.find( g => g.name == dummyGuildName )
			
			let map = []
			let finishedMap = []

			
			if (dummyGuild && savedPuzzles[dummyGuildName]){
				console.log("[Puzzle] using existing dummy guild for the puzzle: " + dummyGuildName )
				
				let myPuzzle = JSON.parse(JSON.stringify(savedPuzzles[dummyGuildName]))
				
				finishedMap = myPuzzle
				map = myPuzzle
				
			} else {
				
				dummyGuild = await handlePuzzleGuildCache(bot, dummyGuildName, reply, puzzleBlocks * puzzleBlocks)
				//console.log(dummyGuild.name)
				let result = null
				
				if (url.includes(".gif")){
					//result = await handleGif(dummyGuild, url, message, reply)
					result = await handleBitmap(dummyGuild, lenna, pictureSize, puzzleBlocks, blockSize, reply)
				} else { 
					result = await handleBitmap(dummyGuild, lenna, pictureSize, puzzleBlocks, blockSize, reply)
				}
				
				finishedMap = result.finishedMap
				map = result.map
				
				//console.log(finishedMap)
				//console.log(map)
				
				savedPuzzles[dummyGuildName] = finishedMap
				
				await writeFileAtomic('puzzles.json', JSON.stringify(savedPuzzles, null, 2)) //, { indent: 2 }
			}
			
			
			
			let currentPos = { x: puzzleBlocks - 1, y: puzzleBlocks - 1 }
			
			let finalString = ""
			
			for (let y = 0; y < mapDimensions.y; y++){
				for (let x = 0; x < mapDimensions.x; x++){
					
					if (y == currentPos.y && x == currentPos.x){
						finalString += map[0][0].empty
					} else {
						finalString += map[y][x].normal
					}
				}
				finalString += "\n"
			}
			
			let iterarions = (words[2] && !isNaN(words[2])) ? words[2] : 20
			
			if (iterarions < 1) iterarions = 1
			if (iterarions > 10000) iterarions = 10000
			
			let shuffleResult = shuffleMap(map, iterarions, puzzleBlocks)
			
			currentPos = shuffleResult.pos
			map = shuffleResult.map
			
			let shuffledMap = ""
			
			for (let y = 0; y < mapDimensions.y; y++){
				for (let x = 0; x < mapDimensions.x; x++){
					
					if (y == currentPos.y && x == currentPos.x){
						shuffledMap += map[0][0].empty
					} else {
						shuffledMap += map[y][x].normal
					}
				}
				shuffledMap += "\n"
			}
			
			/*
			// Create a 10 x 10 gif
			var GifEncoder = require('gif-encoder');
			var gif = new GifEncoder(10, 10);
			 
			// using an rgba array of pixels [r, g, b, a, ... continues on for every pixel]
			// This can be collected from a <canvas> via context.getImageData(0, 0, width, height).data
			var pixels = [0, 0, 0, 255];
			 
			// Collect output
			var file = require('fs').createWriteStream('img.gif');
			gif.pipe(file);
			 
			// Write out the image into memory
			gif.writeHeader();
			gif.addFrame(pixels);
			// gif.addFrame(pixels); // Write subsequent rgba arrays for more frames
			gif.finish();
			*/
			
			await reply.edit({ 
				content: shuffledMap, 
				embed: {
					color: 0x2f3136,
					fields: [
						{ name: "Player", value: `<@${message.author.id}>`, inline: true },
						{ name: "Moves", value: "0", inline: true },
						{ name: "Time", value: "0 sec", inline: true },
					]
				}
			})


			activePuzzles[reply.id] = {
				imageUrl: url,
				mainMsg: reply,
				botMsg: reply2,
				finalString: finalString,
				map: map,
				userID: message.author.id,
				currentPos: { x: currentPos.x, y: currentPos.y },
				started: Date.now(),
				moves: 0
			}
			
		/*
			setTimeout( async () => {
				if (activePuzzles[reply.id]){
					delete activePuzzles[reply.id]
					await message.channel.createMessage("puzzle timed out (10min)")
					await reply.removeReactions()
				}
			}, 600000) // 600 * 1000 = 10 minutes
		*/
		
			// let reactions1 = [ "empty:483396476488122368", "⬆️", "empty2:680169811875070044" ]
			let reactions1 = [ "⚫", "⬆️", "⬛" ]
			for (r of reactions1) await reply.addReaction(r)
			
			let reactions2 = [ "⬅️", "⬇️", "➡️" ]
			for (r of reactions2) await reply2.addReaction(r)
		
			
		} catch (e) {

			try {
				
				console.log("[*] Something went wrong #1:", e.message)
				
				await reply.edit({
					content: "<@" + message.author.id + ">",
					embed: {
						color: 0xff0000,
						author: {
							icon_url: "https://cdn.discordapp.com/emojis/474256522550181918.png", 
							name: "Something broke: " + e.message
						}
					}
				})
				
			//	setTimeout(async () => {
			//		await bot.deleteMessage(reply.channel.id, reply.id)
			//	}, 10000); // 10000 ms = 10 seconds
				
			} catch (e) {
				console.log("[*] Something went wrong #2:", e)
			}
		}

	}
}

function handleBitmap(dummyGuild, lenna, pictureSize, puzzleBlocks, blockSize, reply){
	return new Promise( async (resolve, reject) => {
		try {
			let finishedMap = []
			let map = []
			
			for (let i = 0; i < puzzleBlocks; i++){
				
				if ( i == (puzzleBlocks-1) ){
					await reply.edit({
						embed: {
							color: 0xffb216,
							author: {
								icon_url: "https://cdn.discordapp.com/emojis/559109614050738219.gif?", 
								name: "Puzzle should be ready any moment now..."
							}
						}
					})
				}
				
				finishedMap[i] = []
				map[i] = []
				
				for (let j = 0; j < puzzleBlocks; j++){
					
					let smol = await lenna.clone().crop( blockSize * j, blockSize * i, blockSize, blockSize )
					let base64 = await smol.getBase64Async(Jimp.MIME_PNG)
					let e = await dummyGuild.createEmoji({ name: lenna.hash(), image: base64 })
					
					finishedMap[i][j] = {
						normal: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`,
						desiredPos: {
							x: i,
							y: j
						}
					}
					
					//console.log(finishedMap[i][j].normal)
					
					map[i][j] = JSON.parse(JSON.stringify(finishedMap[i][j]))

				}
			}
			
			let emptyLenna = await Jimp.read("./other/empty.png")
			let emptyBase64 = await emptyLenna.getBase64Async(Jimp.MIME_PNG)
			let empty = await dummyGuild.createEmoji({ name: 'empty', image: emptyBase64 })
			
			map[0][0].empty = `<${empty.animated ? "a" : ""}:${empty.name}:${empty.id}>`
			
			resolve( {finishedMap, map} )
		} catch (e){
			//console.log("hi")
			console.log(e)
			reject(e)
		}
	})
}
/*
async function handleGif(dummyGuild, url, message, reply){
	return new Promise( async (resolve, reject) => {
		try {
			if (!fs.existsSync('./temp_imgs')) {
				await fs.mkdirSync('./temp_imgs');
			}
			if (!fs.existsSync(`./temp_imgs/${message.id}`)) {
				await fs.mkdirSync(`./temp_imgs/${message.id}`)
			}
			if (!fs.existsSync(`./temp_imgs/${message.id}/output`)) {
				await fs.mkdirSync(`./temp_imgs/${message.id}/output`)
			}
			
			let gifBuffer = await rp(url)
			
			await fs.writeFileSync(`./temp_imgs/${message.id}/original.gif`, gifBuffer)
			console.log('[Puzzle] Doing gif stuff - saved original.gif')
			
			let lenna = await Jimp.read(`./temp_imgs/${message.id}/original.gif`)
			
			//console.log(lenna.bitmap.width) //  width of the image
			//console.log(lenna.bitmap.height) // height of the image
			
			let squareLen = Math.min(lenna.bitmap.width, lenna.bitmap.height)
			
			let pictureSize = squareLen // = 240  // 240x240 
			let puzzleBlocks = mapDimensions.x
			let blockSize = Math.floor(pictureSize / puzzleBlocks)  // 48x48

			//execFile(gifsicle, ['--resize', `${blockSize}x${blockSize}`, '-o', '--crop', `0,0+18x18`, `./temp_imgs/${message.id}/square.gif`, `./temp_imgs/${message.id}/original.gif`])
			
			for (let j = 0; j < puzzleBlocks; j++){
			
				for (let i = 0; i < puzzleBlocks; i++){
					
					//let smol = await lenna.clone().crop( blockSize * j, blockSize * i, blockSize, blockSize )
					execFile(gifsicle, ['--resize', `${blockSize}x${blockSize}`,
										'--crop', `${blockSize*i},${blockSize*j}+${blockSize}x${blockSize}`, 
										'-o', `./temp_imgs/${message.id}/output/${j}-${i}.gif`, `./temp_imgs/${message.id}/original.gif`])
				
				}
			}
			
			await delay(1000)
			
			let filenames = glob.sync(`./temp_imgs/${message.id}/output/*.gif`)//.map( f => path.resolve(f) )
			//console.log(filenames)
			
			let counter = 0
			
			let finishedMap = []
			let map = []
				
			for (let i = 0; i < puzzleBlocks; i++){
				
				if ( i == (puzzleBlocks-1) ){
					await reply.edit({
						embed: {
							color: 0xffb216,
							author: {
								icon_url: "https://cdn.discordapp.com/emojis/559109614050738219.gif?", 
								name: "Puzzle should be ready any moment now..."
							}
						}
					})
				}
				
				finishedMap[i] = []
				map[i] = []
				
				for (let j = 0; j < puzzleBlocks; j++){
					
					//let smol = await lenna.clone().crop( blockSize * j, blockSize * i, blockSize, blockSize )
					//let base64 = await smol.getBase64Async(Jimp.MIME_PNG)
					if (filenames[counter]) {
						
						let buffer = await fs.readFileSync(filenames[counter])
						let base64 = `data:image/gif;base64,${buffer.toString('base64')}`;
						
						//console.log(base64)
						
						let e = await dummyGuild.createEmoji({ name: 'ImagePuzzle', image: base64 })
						
						finishedMap[i][j] = {
							from: null,
							to: null,
							normal: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`,
							desiredPos: {
								x: i,
								y: j
							}
						}
						
						//console.log(finishedMap[i][j].normal)
						
						map[i][j] = JSON.parse(JSON.stringify(finishedMap[i][j]))
						counter++
					
					} else {
						console.log("shit? array mismatch")
						break
					}
					
				}
			}
			
			
			// remove all the files
			rimraf(`./temp_imgs/${message.id}`, () => { console.log("[Puzzle] Cleared temp folders") })
			
			resolve( {finishedMap, map} )
		} catch (e) {
			reject(e)
		}
	})
}
*/

function handlePuzzleGuildCache(bot, dummyGuildName, reply, blocks){
	return new Promise( async (resolve, reject) => {
		try {
			
			let oldestPuzzleGuild = Number.MAX_VALUE
			let allGuilds = bot.guilds.size
			let cacheGuilds = bot.guilds.filter( g => g.ownerID == bot.user.id )
			
			if (allGuilds > 10){
				let errorMsg = new Error("Bot is currently in more than 10 guilds, therefore discord API won't allow it to make any new guilds")
				reject(errorMsg)
				return
			}
			
			let puzzleGuildCache = 10 - (allGuilds - cacheGuilds.length)
			
			if (cacheGuilds.length >= puzzleGuildCache){
				cacheGuilds.forEach( g => {
					if (g.id < oldestPuzzleGuild){
						oldestPuzzleGuild = g.id
					}
				})
				
				if (oldestPuzzleGuild == Number.MAX_VALUE){
					console.log("[Puzzle] The bot is not in any guilds?")
					return
				}
				
				await bot.deleteGuild(oldestPuzzleGuild)
				console.log(`[Puzzle] Deleting guild... ${bot.guilds.get(oldestPuzzleGuild).name}`)
			}

			dummyGuild = await bot.createGuild( dummyGuildName )
			console.log(`[Puzzle] Created dummy guild for the puzzle: ${dummyGuildName}`)
			
			resolve(dummyGuild)
			
			
		} catch (e){
			reject(e)
		}
	})
}

function shuffleMap(toShuffle, iterarions, puzzleBlocks){

	let currentPos = { x: puzzleBlocks - 1, y: puzzleBlocks - 1 }
	
	for (let i = 0; i < iterarions; i++){
		
		let dir = {
			x: 0,
			y: 0
		}
	
		let oldX = currentPos.x
		let oldY = currentPos.y
		
		if (i % 2){
			
			dir.x = Math.random() > 0.5 ? 1 : -1
			
			if (currentPos.x >= puzzleBlocks - 1){
				dir.x = -1
			}
			
			if (currentPos.x <= 0){
				dir.x = 1
			}
			
			currentPos.x += dir.x
			
		} else {
			
			dir.y = Math.random() > 0.5 ? 1 : -1
			
			if (currentPos.y >= puzzleBlocks - 1){
				dir.y = -1
			}
			
			if (currentPos.y <= 0){
				dir.y = 1
			}
			
			currentPos.y += dir.y
			
		}
		
		let tmpTile = toShuffle[currentPos.y][currentPos.x]
		
		//console.log(currentPos.x, currentPos.y)
		//console.log(map)
		
		toShuffle[oldY][oldX] = toShuffle[currentPos.y][currentPos.x]
		toShuffle[currentPos.y][currentPos.x] = tmpTile
		
	}
	
	return { pos: currentPos, map: toShuffle}
}

function optimizeDiscordUrl(imgUrl){
	
	if (imgUrl.includes("media.discordapp.net")) {
		return imgUrl.split("?")[0] + "?width=640&height=640"
	} else if (imgUrl.includes(".discordapp.")){
		return imgUrl.replace("cdn.discordapp.com", "media.discordapp.net") + "?width=640&height=640"
	} else {
		return imgUrl
	}
	
}

function checkURLforImage(url) {
	return new Promise((resolve, reject) => {

		if (!url.includes(".")) {
			resolve(false)
			return
		}

		request.get({ url: url, method: 'HEAD' }, async (err, httpResponse, body) => {

			if (err) {
				//console.log(err)
				resolve(false)
				return
			}
			
			if (!httpResponse.headers["content-type"]) {
				resolve(false)
				return
			}
			else if (/4\d\d/.test(httpResponse.headers.statusCode) === true) 
			{
				console.log(httpResponse.headers.statusCode)
				resolve(false)
				return
			}
			else if (httpResponse.headers["content-type"].includes("image"))
			{
				resolve(url)
				return
			}
			
			resolve(false)
			
		})

	})
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function workingOnIt(id){
	return {
		content: "<@" + id + ">",
		embed: {
			color: 0xffb216,
			author: {
				icon_url: "https://cdn.discordapp.com/emojis/559109614050738219.gif?", 
				name: "I'm working on it..."
			}
		}
	}
}

module.exports.setupMsgs = setupMsgs
module.exports.activePuzzles = activePuzzles
//module.exports.tiles = tiles
//module.exports.currentPos = currentPos
//module.exports.mapDimensions = mapDimensions