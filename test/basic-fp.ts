import fastify from 'fastify'
import WebSocket from 'ws'
import graaspWebSockets from '../src/service-api'

const N_CLIENTS = 5
const PORT = 3000
const ADDRESS = '127.0.0.1'
const PREFIX = '/ws'

const server = fastify()

server.register(graaspWebSockets, { prefix: PREFIX })

server.listen(PORT, ADDRESS, (err, addr) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.log(`Server started on ${addr}`)
    runClients()
})

function runClients() {
    let connString = `ws://${ADDRESS}:${PORT}${PREFIX}`
    let sockets = Array(N_CLIENTS).fill(null).map(_ => new WebSocket(connString))

    const receive = Promise.all(
        sockets.map(s =>
            new Promise((resolve, reject) => {
                s.on('message', data => resolve(data))
                s.on('error', error => reject(error))
            })
            .finally(() => { s.close() })
        )
    )

    let sender = new WebSocket(connString)
    sender.on('open', () => { sender.send('hello world!') })

    receive.then(values => console.log(values))
}