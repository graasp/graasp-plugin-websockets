import WebSocket from 'ws'
import { WebSocketChannels } from '../src/ws-channels'

const N_CLIENTS = 5
const PORT = 3000
const ADDRESS = '127.0.0.1'

const server = new WebSocket.Server({ port: PORT })
const wsChannels = new WebSocketChannels(server)

server.on('connection', ws => {
    console.log(`Server: new conn ${ws}`)

    ws.on('message', data => {
        console.log(`Server: received ${data}`)
        wsChannels.broadcast(data)
    })
})

runClients()

function runClients() {
    let connString = `ws://${ADDRESS}:${PORT}`
    let sockets = Array(N_CLIENTS).fill(null).map(_ => new WebSocket(connString))

    const receive = Promise.all(
        sockets.map(s =>
            new Promise((resolve, reject) => {
                s.on('message', data => resolve(data))
                s.on('error', error => reject(error))
            })
            .finally(() => { s.close })
        )
    )

    let receiver = new WebSocket(connString)
    receiver.on('message', data => console.log(`Client received: ${data}`))

    let sender = new WebSocket(connString)
    sender.on('open', () => { sender.send('hello world!') })

    receive
        .then(values => console.log(values))
        .catch(err => console.error(err))
}