let Puzzle = require("./puzzle.js")

const getPixels = require("get-pixels")

let directions = {
	"⬆️":  	{ x:  0 , y: -1 },
	"⬇️": 	{ x:  0 , y:  1 },
	"➡️":  	{ x:  1 , y:  0 },
	"⬅️": 	{ x: -1 , y:  0 }
}

module.exports = {
	name: "puzzle-react",
	event: "MESSAGE_REACTION_ADD",
	desc: "---",
	run: async (bot, guilds, stats, reactionMessage, emoji, userID) => {
		
		try {
			
			if (Puzzle.setupMsgs[reactionMessage.id]){
				
				let reactions = [ "3️⃣", "4️⃣", "5️⃣" ]
				
				if (!reactions.includes(emoji.name)){
					console.log("[puzzle setup] unsupported emoji")
					return
				}
				
				let gridSize = emoji.name.slice(0,1)
				Puzzle.generate(bot, Puzzle.setupMsgs[reactionMessage.id], guilds, null, gridSize)
				
				delete Puzzle.setupMsgs[reactionMessage.id]
				
				let setupMsg = await bot.getMessage(reactionMessage.channel.id, reactionMessage.id)
				setupMsg.delete()
				
				return
			}
			
			if (!Puzzle.activePuzzles[reactionMessage.id] && !Object.values(Puzzle.activePuzzles).find( p => p.botMsg.id == reactionMessage.id)){
				return
			}
			
			let message = null
			let thisMessage = await bot.getMessage(reactionMessage.channel.id, reactionMessage.id)
			let thisPuzzle = Puzzle.activePuzzles[thisMessage.id]
			
			if (thisPuzzle){
				
				message = thisMessage
				
			} else {
				
				thisPuzzle = Object.values(Puzzle.activePuzzles).find( p => p.botMsg.id == reactionMessage.id)
				if (!thisPuzzle) return

				message = await bot.getMessage(reactionMessage.channel.id, thisPuzzle.mainMsg.id)
				
			}
			
			if (!thisMessage) return
			
			if (message.author.id == bot.user.id){
				
				//let thisPuzzle = Puzzle.activePuzzles[message.id]
				
				if (!thisPuzzle){
					console.log("no active puzzle found")
					return
				}
				
				let reactions = [ "⬆️", "⬇️", "⬅️", "➡️" ]
				
				if (!reactions.includes(emoji.name)){
					//console.log("unsupported emoji")
					return
				}
				
				
				await thisMessage.removeReaction(emoji.name, userID)
				
				if (!Puzzle.activePuzzles[message.id]) return
				if (thisPuzzle.userID != userID) return
				
				let currentPos = thisPuzzle.currentPos
				
				let oldX = currentPos.x
				let oldY = currentPos.y
				
				let newX = currentPos.x + directions[emoji.name].x
				let newY = currentPos.y + directions[emoji.name].y

				let mapDimensions = {
					x: thisPuzzle.map.length,
					y: thisPuzzle.map.length
				}
				
				if ((newX >= mapDimensions.x) || (newY >= mapDimensions.y) || (newX <= -1) || (newY <= -1) ){
					
					//message.channel.createMessage(`<@${userID}>: invalid move`)
					return
				}
				
				let map = thisPuzzle.map
				let tmpTile = map[currentPos.y][currentPos.x]
				
				currentPos.x = newX
				currentPos.y = newY
				
				//console.log(Puzzle.currentPos.x, Puzzle.currentPos.y)
				//console.log(map)
				
				map[oldY][oldX] = map[currentPos.y][currentPos.x]
				map[currentPos.y][currentPos.x] = tmpTile
				
				
				
				let stringifyMap = ""
				
				for (let y = 0; y < mapDimensions.y; y++){
					for (let x = 0; x < mapDimensions.x; x++){
						if (y == currentPos.y && x == currentPos.x){
							stringifyMap += map[0][0].empty
						} else {
							stringifyMap += map[y][x].normal
						}
					}
					stringifyMap += "\n"
				}
				
				thisPuzzle.moves = thisPuzzle.moves + 1
				
				let ms = Date.now() - thisPuzzle.started
				let timePassed = format( ms/1000 )
					
				let embed = {
					color: 0x2f3136,
					fields: [
						{ name: "Player", value: `<@${userID}>`, inline: true },
						{ name: "Moves", value: thisPuzzle.moves, inline: true },
						{ name: "Time", value: timePassed, inline: true }
					]
				}
				
				if (checkForWin(thisPuzzle, stringifyMap)){
					
					
					await message.channel.createMessage(`<@${userID}>: you won! Completed puzzle in **${thisPuzzle.moves}** moves / **${timePassed}**`)

					embed.color = await getPixelsPromise(thisPuzzle.imageUrl)
					
					/*
					let randomEmojis = [ 
						"<a:KyoukoDansen:627870990982053898>", 
						"<a:HomuDansen:627871001723535371>", 
						"<a:MadoDansen:627871007075729428>",
						"<a:TakagiDansen:664573576590131219>",
						"<a:xEmiDance:571008054699753482>",
						"<a:x02hop:526065395736641536>"
					]
					*/
					
					let randomEmojis = [ "❤️", "💚", "💙", "💛", "💜" ]
					
					let index = Math.floor(Math.random() * randomEmojis.length)
					let randomEmoji = randomEmojis[index]
					
					await message.edit({ 
						content: stringifyMap.replace(map[0][0].empty, randomEmoji), 
						embed: embed
					})
				
					delete Puzzle.activePuzzles[message.id]
					await thisPuzzle.mainMsg.removeReactions()
					await thisPuzzle.botMsg.delete()
					
				} else {
					// ...
					
					await message.edit({ 
						content: stringifyMap, 
						embed: embed
					})
				}
				
			
			}
			
			
		} catch (e) {
			console.log("[*] Something went wrong:", e.message)
		}

	}
}

function format(ms){

	let hours = Math.floor(ms / (60*60))
	let minutes = Math.floor(ms % (60*60) / 60)
	let seconds = Math.floor(ms % 60)

	let string = ""
	
	if (hours != 0) string += `${hours} h `
	if (minutes != 0) string += `${minutes} min `
	if (seconds != 0) string += `${seconds} sec`

	return string
}

function getPixelsPromise(imgUrl) {
	return new Promise(function(resolve, reject) {
		
		if (!imgUrl.includes(".discordapp.")){
			resolve(0xffb216)
		} else {
			
			if (imgUrl.includes("media.discordapp.net")) {
				imgUrl = imgUrl.split("?")[0] + "?width=100&height=100"
			} else {
				imgUrl = imgUrl.replace("cdn.discordapp.com", "media.discordapp.net") + "?width=100&height=100"
			}
			
			//imgUrl = imgUrl.replace("cdn.discordapp.com", "media.discordapp.net") + "?width=100&height=100"
			
			getPixels(imgUrl, function(err, pixels) {
				
				if (err) {
					resolve(0xffb216)
					console.log("[Puzzle] getPixels err " + err)
					return
				}
				
				let w = 0 //parseInt(pixels.shape[0]/2)
				let h = 0 //parseInt(pixels.shape[1]/5)
				
				let r, g, b
				
				if (imgUrl.split(".").pop().toLowerCase().includes("gif")){
					
					r = pixels.get(0, w, h, 0).toString(16)
					g = pixels.get(0, w, h, 1).toString(16)
					b = pixels.get(0, w, h, 2).toString(16)
					
				} else {
					
					r = pixels.get(w, h, 0).toString(16)
					g = pixels.get(w, h, 1).toString(16)
					b = pixels.get(w, h, 2).toString(16)
					
				}
				
				let rawColor = parseInt(r+g+b, 16)
				//console.log("color: " + rawColor)
				
				resolve(rawColor||0xffb216)
				return
			})
			
		}
		
	})
}

function checkForWin(puzzle, currentString){
	
	if (puzzle.finalString == currentString){
		return true
	} else {
		return false
	}
	
	
	/*
	for (let y = 0; y < Puzzle.mapDimensions.y; y++){
		for (let x = 0; x < Puzzle.mapDimensions.x; x++){
			//console.log(map[y][x].desiredPos)
			if (x == 4 && y == 4) continue
			if (map[y][x].desiredPos.x != y ) return false
			if (map[y][x].desiredPos.y != x ) return false
		}
	}
	
	return true
	*/
}
