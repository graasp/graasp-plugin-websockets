import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (fastify) => {
    
}

export default fp(plugin, {
    fastify: '3.x',
    name: 'graasp-websockets',
})