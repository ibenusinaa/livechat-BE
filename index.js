const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const http = require('http')
const socket = require('socket.io')

// initialize
const app = express()
app.use(cors())
const httpApp = http.createServer(app)
const io = socket(httpApp)

const PORT = process.env.PORT || 5000 //buat deploy di heroku (process.env.PORT)

const db = mysql.createConnection({
    host: 'sql6.freemysqlhosting.net',
    user: 'sql6409073',
    password: '32eBfdFIfT',
    database: 'sql6409073',
    port: 3306
})

// Routes
app.get('/', (req, res) => {
    res.send('Livechat API Online')
})

let userConnected = []

io.on('connection', (socket) => {
    console.log('user connected with id ' + socket.id)
    // USER JOIN
    socket.on('user-join', ({name, room}) => {
        let checkTotalUserInRoom = userConnected.filter((value) => value.room === room)
        console.log(checkTotalUserInRoom)
        if(checkTotalUserInRoom.length >= 4){
            return socket.emit('total-user', checkTotalUserInRoom.length)
        }else{
            let dataToSend = {
                user: name,
                socket_id: socket.id
            }
            socket.emit('total-user', checkTotalUserInRoom.length)
                    userConnected.push({
                        id: socket.id,  
                        name: name,
                        room: room
                    })
                    socket.join(room)
                    let userInRoom = userConnected.filter((value) => value.room === room)
            
                    io.in(room) .emit('user-online', userInRoom)
                    
                    console.log(userConnected)
                    socket.to(room).emit('send-message-from-server', {from: 'Bot', message: name + ' has join the room'})

            // db.query('INSERT INTO users SET ?', dataToSend, (err, result) => {
            //     try {
            //         if(err) throw err
            //         console.log(result)
            //         socket.emit('total-user', checkTotalUserInRoom.length)
            //         userConnected.push({
            //             id: socket.id,  
            //             name: name,
            //             room: room
            //         })
            //         socket.join(room)
            //         let userInRoom = userConnected.filter((value) => value.room === room)
            
            //         io.in(room) .emit('user-online', userInRoom)
                    
            //         console.log(userConnected)
            //         socket.to(room).emit('send-message-from-server', {from: 'Bot', message: name + ' has join the room'})
            //     } catch (error) {
            //         console.log(err)
            //     }
            // } )
            // get chat history
            db.query('SELECT * FROM chat_history WHERE room = ?', room, (errChat, resultChat) => {
                try {
                    if(errChat) throw errChat
                    let res = []
                    resultChat.map((value, index) => {
                        res.push({
                            created_at: value.created_at.toLocaleString(),
                            id: value.id,
                            message: value.message,
                            room: value.room,
                            socket_id: value.socket_id,
                            user: value.user,
                        })
                    })
                    socket.emit('history', res)           
                } catch (error) {
                    console.log(error)
                }
            })
            
        }
        
    })
    // send message user
    socket.on('send-message', (message) => {
        // console.log(userConnected)
        // console.log(message)

        // buat kirim ke room butuh index, room, user yg kirim siapa
        let index = null
        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        let room = userConnected[index].room

        let dataToSend = {
            user: message.user, 
            message: message.message,
            socket_id: socket.id,
            room: room
        }
        // roomName, socket.id, username, message, created_At
        let date = new Date().toLocaleString()

        db.query('INSERT INTO chat_history SET ?', dataToSend, (err, result) => {
            try {
                if(err) throw err

                socket.to(room).emit('send-message-back', {user: message.user, message: message.message, room: room, created_at: date})
                socket.emit('send-message-back', {user: message.user, message: message.message, room: room, created_at: date})
            } catch (error) {
                console.log(error)
               
            }
        })
        
    })

    // user typing
    socket.on('typing', (message) => {
        console.log(message)
        let index = null
        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        let room = userConnected[index].room

        socket.to(room).emit('typing-back', {user: message.user, message: message.message, room: room})
    })


    socket.on('disconnect', () => {
        // USER DISCONNECTED
        console.log('user disconnected')

        let index = null
        userConnected.forEach((value, idx) => {
            if(value.id === socket.id){
                index = idx
            }
        })

        if(index !== null){
            var name = userConnected[index].name
            var room = userConnected[index].room
            userConnected.splice(index, 1)
        }
        console.log(userConnected)
        socket.to(room).emit('send-message-from-server', {from: 'Bot', message: name + ' left the room'})
    })
})

// create server
httpApp.listen(PORT, () => {
    console.log('Server Runnin on Port ' + PORT)
})