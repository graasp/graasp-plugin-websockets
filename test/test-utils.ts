import fastify, { FastifyInstance } from 'fastify'
import graaspWebSockets from '../src/service-api'
import WebSocket from 'ws'
import { WebSocketChannels } from '../src/ws-channels'

const PORT = 3000
const ADDRESS = '127.0.0.1'
const PREFIX = '/ws'
const connUrl = `ws://${ADDRESS}:${PORT}${PREFIX}`

function createWsChannels(): {channels: WebSocketChannels, wss: WebSocket.Server} {
    const server = new WebSocket.Server({ port: PORT })
    const wsChannels = new WebSocketChannels(server)
    
    server.on('connection', ws => {
        ws.on('message', data => {
            if (typeof(data) === 'string') {
                const channelName = data
                wsChannels.clientSubscribe(ws, channelName)
            }
        })
    })

    return {
        channels: wsChannels,
        wss: server,
    }
}

function createFastifyInstance(): Promise<FastifyInstance> {
    const promise = new Promise<FastifyInstance>((resolve, reject) => {
        const server = fastify()

        server.register(graaspWebSockets, { prefix: PREFIX })
    
        server.listen(PORT, ADDRESS, (err, addr) => {
            if (err) {
                console.error(err)
                reject(err)
                process.exit(1)
            }
            console.log(`Server started on ${addr}`)
            resolve(server)
        })
    })

    return promise
}

function createWsClients(numberClients: number): Array<WebSocket> {
    return Array(numberClients).fill(null).map(_ => new WebSocket(connUrl))
}

function clientsExpect(clients: Array<WebSocket>, expected: any, equalsFun: Function = (a,b) => (a === b)): Promise<boolean> {
    return Promise.all(
        clients.map(client => {
            new Promise((resolve, reject) => {
                client.on('message', data => resolve(data))
                client.on('error', error => reject(error))
            })
        })
    ).then(values => {
        console.log('Expected: ' + expected)
        console.log('Actual: ' + values)
        return values.every(v => equalsFun(v, expected))
    }).catch(err => {
        console.log('Promise rejected: ' + err)
        return false
    })
}

class Test {
    name: string
    result: Promise<boolean>
    constructor(name, result) {
        this.name = name
        this.result = result
    }
}

function showResults(tests: Array<Test>) {
    return Promise.all(tests.map(t => {
        t.result.then(b => {
            if (b) console.log(`${t.name} successful`)
            else console.log(`${t.name} wrong result`)
        }).catch(err => console.log(`${t.name} failed with ${err}`))
    }))
}

export { createWsChannels, createFastifyInstance, createWsClients, clientsExpect, Test, showResults, connUrl }