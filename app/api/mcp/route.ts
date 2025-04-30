import { NextRequest, NextResponse } from 'next/server';
import { initializeServer } from '../../../src/mcp/server';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';

// Create a custom response type that tracks the headers and statusCode
type CustomResponse = {
    statusCode: number;
    headersSent: boolean;
    headers: Record<string, string | string[] | undefined>;
    status(code: number): CustomResponse;
    setHeader(name: string, value: string | string[]): CustomResponse;
    getHeader(name: string): string | string[] | undefined;
    removeHeader(name: string): CustomResponse;
    json(data: any): NextResponse;
    send(data: string): NextResponse;
    write(): boolean;
    end(): void;
    once(): void;
    on(): void;
};

// This is a special Next.js API route that implements a stateless MCP server
export async function POST(request: NextRequest) {
    try {
        // Initialize the MCP server with resources from our API
        const server = await initializeServer();

        // Create a stateless transport for handling this request
        // Pass an options object with sessionIdGenerator set to undefined for stateless mode
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        // Connect the server to the transport
        await server.connect(transport);

        // Use req and res objects for handling the request
        const body = await request.json().catch(() => null);

        // Create a custom response object that implements the necessary ServerResponse interface methods
        const res: CustomResponse = {
            statusCode: 200,
            headersSent: false,
            headers: {},

            status(code: number) {
                this.statusCode = code;
                return this;
            },

            setHeader(name: string, value: string | string[]) {
                this.headers[name] = value;
                return this;
            },

            getHeader(name: string) {
                return this.headers[name];
            },

            removeHeader(name: string) {
                delete this.headers[name];
                return this;
            },

            json(data: any) {
                const responseHeaders = {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    ...Object.entries(this.headers).reduce((acc, [key, value]) => {
                        if (value !== undefined) acc[key] = Array.isArray(value) ? value.join(', ') : value;
                        return acc;
                    }, {} as Record<string, string>)
                };

                return new NextResponse(JSON.stringify(data), {
                    status: this.statusCode,
                    headers: responseHeaders
                });
            },

            send(data: string) {
                const responseHeaders = {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    ...Object.entries(this.headers).reduce((acc, [key, value]) => {
                        if (value !== undefined) acc[key] = Array.isArray(value) ? value.join(', ') : value;
                        return acc;
                    }, {} as Record<string, string>)
                };

                return new NextResponse(data, {
                    status: this.statusCode,
                    headers: responseHeaders
                });
            },

            write: () => true,
            end: () => { },
            once: () => { },
            on: () => { },
        };

        // Create a custom request object that implements the IncomingMessage interface
        const req: Partial<IncomingMessage> = {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries()),
            // Create a readable stream for body if needed by the transport
            read: () => { }
        };

        // Handle the request using the transport's handleRequest method
        await transport.handleRequest(
            req as IncomingMessage,
            res as unknown as ServerResponse,
            body
        );

        // Clean up
        transport.close();
        server.close();

        // Since handleRequest should have called res.json or res.send which return NextResponse objects,
        // we need to return a default response in case it didn't
        return new NextResponse(JSON.stringify({ error: 'No response from transport' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    } catch (error) {
        console.error('Error handling MCP request:', error);
        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: error instanceof Error ? error.message : 'Internal server error'
                },
                id: null
            },
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            }
        );
    }
}

// Support OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400', // 24 hours
        },
    });
}

// Also support GET requests for server capabilities
export async function GET(request: NextRequest) {
    try {
        // Initialize the MCP server
        const server = await initializeServer();

        // Create a transport with options for stateless mode
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        // Connect the server to the transport
        await server.connect(transport);

        // Create a custom response object that implements the necessary ServerResponse interface methods
        const res: CustomResponse = {
            statusCode: 200,
            headersSent: false,
            headers: {},

            status(code: number) {
                this.statusCode = code;
                return this;
            },

            setHeader(name: string, value: string | string[]) {
                this.headers[name] = value;
                return this;
            },

            getHeader(name: string) {
                return this.headers[name];
            },

            removeHeader(name: string) {
                delete this.headers[name];
                return this;
            },

            json(data: any) {
                const responseHeaders = {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    ...Object.entries(this.headers).reduce((acc, [key, value]) => {
                        if (value !== undefined) acc[key] = Array.isArray(value) ? value.join(', ') : value;
                        return acc;
                    }, {} as Record<string, string>)
                };

                return new NextResponse(JSON.stringify(data), {
                    status: this.statusCode,
                    headers: responseHeaders
                });
            },

            send(data: string) {
                const responseHeaders = {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    ...Object.entries(this.headers).reduce((acc, [key, value]) => {
                        if (value !== undefined) acc[key] = Array.isArray(value) ? value.join(', ') : value;
                        return acc;
                    }, {} as Record<string, string>)
                };

                return new NextResponse(data, {
                    status: this.statusCode,
                    headers: responseHeaders
                });
            },

            write: () => true,
            end: () => { },
            once: () => { },
            on: () => { },
        };

        // Create a custom request object that implements the IncomingMessage interface
        const req: Partial<IncomingMessage> = {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries()),
            // Create a readable stream for body if needed by the transport
            read: () => { }
        };

        // Handle the request using the transport's handleRequest method
        await transport.handleRequest(
            req as IncomingMessage,
            res as unknown as ServerResponse,
            null
        );

        // Clean up
        transport.close();
        server.close();

        // Since handleRequest should have called res.json or res.send which return NextResponse objects,
        // we need to return a default response in case it didn't
        return new NextResponse(JSON.stringify({ error: 'No response from transport' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    } catch (error) {
        console.error('Error handling MCP GET request:', error);
        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: error instanceof Error ? error.message : 'Internal server error'
                },
                id: null
            },
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            }
        );
    }
}