import {EventEmitter} from "events";
import * as net from "net";
import * as ip from "ip";
import {SmartBuffer} from "smart-buffer";
import {
    DEFAULT_TIMEOUT,
    SocksCommand,
    Socks4Response,
    Socks5Auth,
    Socks5HostType,
    Socks5Response,
    SocksClientOptions,
    SocksClientChainOptions,
    SocksClientState,
    SocksRemoteHost,
    SocksProxy,
    SocksClientBoundEvent,
    SocksClientEstablishedEvent,
    SocksUDPFrameDetails,
    ERRORS,
    SOCKS_INCOMING_PACKET_SIZES,
} from "../common/constants.mjs";
import {
    validateSocksClientOptions,
    validateSocksClientChainOptions,
} from "../common/helpers.mjs";
import { ReceiveBuffer } from "../common/receivebuffer.mjs";
import { SocksClientError, shuffleArray} from "../common/util.mjs";
import { Duplex } from "stream";
import { Logger } from "../../../../common/Logger.mjs";

const log = Logger( "SokcsClient" );

// Exposes SocksClient event types
declare interface SocksClient {
    on(event: "error", listener: (err: SocksClientError) => void): this;
    on(event: "bound", listener: (info: SocksClientBoundEvent) => void): this;
    on(
        event: "established",
        listener: (info: SocksClientEstablishedEvent) => void,
    ): this;

    once(event: string, listener: (...args: any[]) => void): this;
    once(event: "error", listener: (err: SocksClientError) => void): this;
    once(event: "bound", listener: (info: SocksClientBoundEvent) => void): this;
    once(
        event: "established",
        listener: (info: SocksClientEstablishedEvent) => void,
    ): this;

    emit(event: string | symbol, ...args: any[]): boolean;
    emit(event: "error", err: SocksClientError): boolean;
    emit(event: "bound", info: SocksClientBoundEvent): boolean;
    emit(event: "established", info: SocksClientEstablishedEvent): boolean;
}

class SocksClient extends EventEmitter implements SocksClient {
    private options: SocksClientOptions;
    private socket: Duplex;
    private state: SocksClientState;
    // This is an internal ReceiveBuffer that holds all received data while we wait for enough data to process.
    private receiveBuffer: ReceiveBuffer;
    // This is the amount of data we need to receive before we can continue processing SOCKS handshake packets.
    private nextRequiredPacketBufferSize: number;

    // Internal Socket data handlers
    private onDataReceived: (data: Buffer) => void;
    private onClose: (hadError: boolean) => void;
    private onError: (err: Error) => void;
    private onConnect: () => void;

    constructor(options: SocksClientOptions) {
        super();
        this.options = {
            ...options,
        };

        // Validate SocksClientOptions
        validateSocksClientOptions(options);

        // Default state
        this.setState(SocksClientState.Created);
    }

    /**
   * Creates a new SOCKS connection.
   *
   * Note: Supports callbacks and promises. Only supports the connect command.
   * @param options { SocksClientOptions } Options.
   * @param callback { Function } An optional callback function.
   * @returns { Promise }
   */
    static createConnection(
        options: SocksClientOptions,
        // eslint-disable-next-line @typescript-eslint/ban-types
        callback?: Function,
    ): Promise<SocksClientEstablishedEvent> {
    // Validate SocksClientOptions
        validateSocksClientOptions(options, ["connect"]);

        return new Promise<SocksClientEstablishedEvent>((resolve, reject) => {
            const client = new SocksClient(options);
            client.connect(options.existing_socket);
            client.once("established", (info: SocksClientEstablishedEvent) => {
                client.removeAllListeners();
                if (typeof callback === "function") {
                    callback(null, info);
                    resolve(null); // Resolves pending promise (prevents memory leaks).
                } else {
                    resolve(info);
                }
            });

            // Error occurred, failed to establish connection.
            client.once("error", (err: Error) => {
                client.removeAllListeners();
                if (typeof callback === "function") {
                    callback(err);
                    resolve(null); // Resolves pending promise (prevents memory leaks).
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
   * Creates a new SOCKS connection chain to a destination host through 2 or more SOCKS proxies.
   *
   * Note: Supports callbacks and promises. Only supports the connect method.
   * Note: Implemented via createConnection() factory function.
   * @param options { SocksClientChainOptions } Options
   * @param callback { Function } An optional callback function.
   * @returns { Promise }
   */
    static createConnectionChain(
        options: SocksClientChainOptions,
        // eslint-disable-next-line @typescript-eslint/ban-types
        callback?: Function,
    ): Promise<SocksClientEstablishedEvent> {
    // Validate SocksClientChainOptions
        validateSocksClientChainOptions(options);

        // Shuffle proxies
        if (options.randomizeChain) {
            shuffleArray(options.proxies);
        }

        // eslint-disable-next-line no-async-promise-executor
        return new Promise<SocksClientEstablishedEvent>(async (resolve, reject) => {
            let sock: net.Socket;

            try {
                // tslint:disable-next-line:no-increment-decrement
                for (let i = 0; i < options.proxies.length; i++) {
                    const nextProxy = options.proxies[i];

                    // If we've reached the last proxy in the chain, the destination is the actual destination, otherwise it's the next proxy.
                    const nextDestination =
            i === options.proxies.length - 1
                ? options.destination
                : {
                    host: options.proxies[i + 1].ipaddress,
                    port: options.proxies[i + 1].port,
                };

                    // Creates the next connection in the chain.
                    const result = await SocksClient.createConnection({
                        command: "connect",
                        proxy: nextProxy,
                        destination: nextDestination,
                        // Initial connection ignores this as sock is undefined. Subsequent connections re-use the first proxy socket to form a chain.
                    });

                    // If sock is undefined, assign it here.
                    if (!sock) {
                        sock = result.socket;
                    }
                }

                if (typeof callback === "function") {
                    callback(null, {socket: sock});
                    resolve(null); // Resolves pending promise (prevents memory leaks).
                } else {
                    resolve({socket: sock});
                }
            } catch (err) {
                if (typeof callback === "function") {
                    callback(err);
                    resolve(null); // Resolves pending promise (prevents memory leaks).
                } else {
                    reject(err);
                }
            }
        });
    }

    /**
   * Creates a SOCKS UDP Frame.
   * @param options
   */
    static createUDPFrame(options: SocksUDPFrameDetails): Buffer {
        const buff = new SmartBuffer();
        buff.writeUInt16BE(0);
        buff.writeUInt8(options.frameNumber || 0);

        // IPv4/IPv6/Hostname
        if (net.isIPv4(options.remoteHost.host)) {
            buff.writeUInt8(Socks5HostType.IPv4);
            buff.writeUInt32BE(ip.toLong(options.remoteHost.host));
        } else if (net.isIPv6(options.remoteHost.host)) {
            buff.writeUInt8(Socks5HostType.IPv6);
            buff.writeBuffer(ip.toBuffer(options.remoteHost.host));
        } else {
            buff.writeUInt8(Socks5HostType.Hostname);
            buff.writeUInt8(Buffer.byteLength(options.remoteHost.host));
            buff.writeString(options.remoteHost.host);
        }

        // Port
        buff.writeUInt16BE(options.remoteHost.port);

        // Data
        buff.writeBuffer(options.data);

        return buff.toBuffer();
    }

    /**
   * Parses a SOCKS UDP frame.
   * @param data
   */
    static parseUDPFrame(data: Buffer): SocksUDPFrameDetails {
        const buff = SmartBuffer.fromBuffer(data);
        buff.readOffset = 2;

        const frameNumber = buff.readUInt8();
        const hostType: Socks5HostType = buff.readUInt8();
        let remoteHost;

        if (hostType === Socks5HostType.IPv4) {
            remoteHost = ip.fromLong(buff.readUInt32BE());
        } else if (hostType === Socks5HostType.IPv6) {
            remoteHost = ip.toString(buff.readBuffer(16));
        } else {
            remoteHost = buff.readString(buff.readUInt8());
        }

        const remotePort = buff.readUInt16BE();

        return {
            frameNumber,
            remoteHost: {
                host: remoteHost,
                port: remotePort,
            },
            data: buff.readBuffer(),
        };
    }

    /**
   * Internal state setter. If the SocksClient is in an error state, it cannot be changed to a non error state.
   */
    private setState(newState: SocksClientState) {
        if (this.state !== SocksClientState.Error) {
            this.state = newState;
        }
    }

    /**
   * Starts the connection establishment to the proxy and destination.
   * @param existingSocket Connected socket to use instead of creating a new one (internal use).
   */
    public connect(existingSocket?: Duplex) {
        this.onDataReceived = (data: Buffer) => this.onDataReceivedHandler(data);
        this.onClose = () => this.onCloseHandler();
        this.onError = (err: Error) => this.onErrorHandler(err);
        this.onConnect = () => this.onConnectHandler();

        // Start timeout timer (defaults to 30 seconds)
        const timer = setTimeout(
            () => this.onEstablishedTimeout(),
            this.options.timeout || DEFAULT_TIMEOUT,
        );

        // check whether unref is available as it differs from browser to NodeJS (#33)
        if (timer.unref && typeof timer.unref === "function") {
            timer.unref();
        }

        // If an existing socket is provided, use it to negotiate SOCKS handshake. Otherwise create a new Socket.
        if (existingSocket) {
            this.socket = existingSocket;
        } else {
            this.socket = new net.Socket();
        }

        // Attach Socket error handlers.
        this.socket.once("close", this.onClose);
        this.socket.once("error", this.onError);
        this.socket.once("connect", this.onConnect);
        this.socket.on("data", this.onDataReceived);

        this.setState(SocksClientState.Connecting);
        this.receiveBuffer = new ReceiveBuffer();

        if (existingSocket) {
            this.socket.emit("connect");
        } else {
            (this.socket as net.Socket).connect(this.getSocketOptions());

            if (
                this.options.set_tcp_nodelay !== undefined &&
        this.options.set_tcp_nodelay !== null
            ) {
                (this.socket as net.Socket).setNoDelay(!!this.options.set_tcp_nodelay);
            }
        }

        // Listen for established event so we can re-emit any excess data received during handshakes.
        this.prependOnceListener("established", (info) => {
            setImmediate(() => {
                if (this.receiveBuffer.length > 0) {
                    const excessData = this.receiveBuffer.get(this.receiveBuffer.length);

                    info.socket.emit("data", excessData);
                }
                info.socket.resume();
            });
        });
    }

    // Socket options (defaults host/port to options.proxy.host/options.proxy.port)
    private getSocketOptions(): net.SocketConnectOpts {
        return {
            ...this.options.socket_options,
            host: this.options.proxy.host || this.options.proxy.ipaddress,
            port: this.options.proxy.port,
        };
    }

    /**
   * Handles internal Socks timeout callback.
   * Note: If the Socks client is not BoundWaitingForConnection or Established, the connection will be closed.
   */
    private onEstablishedTimeout() {
        if (
            this.state !== SocksClientState.Established &&
      this.state !== SocksClientState.BoundWaitingForConnection
        ) {
            this.closeSocket(ERRORS.ProxyConnectionTimedOut);
        }
    }

    /**
   * Handles Socket connect event.
   */
    private onConnectHandler() {
        this.setState(SocksClientState.Connected);

        // Send initial handshake.
        if (this.options.proxy.type === 4) {
            this.sendSocks4InitialHandshake();
        } else {
            this.sendSocks5InitialHandshake();
        }

        this.setState(SocksClientState.SentInitialHandshake);
    }

    /**
   * Handles Socket data event.
   * @param data
   */
    private onDataReceivedHandler(data: Buffer) {
    /*
      All received data is appended to a ReceiveBuffer.
      This makes sure that all the data we need is received before we attempt to process it.
    */
        this.receiveBuffer.append(data);

        // Process data that we have.
        this.processData();
    }

    /**
   * Handles processing of the data we have received.
   */
    private processData() {
    // If we have enough data to process the next step in the SOCKS handshake, proceed.
        while (
            this.state !== SocksClientState.Established && this.receiveBuffer.length >= this.nextRequiredPacketBufferSize
        ) {
            log.debug( "processData: %d %s", this.receiveBuffer.length, this.receiveBuffer.get(0) );
            // Sent initial handshake, waiting for response.
            if (this.state === SocksClientState.SentInitialHandshake) {
                log.debug( "processData: SentInitialHandshake" );
                if (this.options.proxy.type === 4) {
                    // Socks v4 only has one handshake response.
                    this.handleSocks4FinalHandshakeResponse();
                } else {
                    // Socks v5 has two handshakes, handle initial one here.
                    this.handleInitialSocks5HandshakeResponse();
                }
                // Sent auth request for Socks v5, waiting for response.
            } else if (this.state === SocksClientState.SentAuthentication) {
                log.debug( "processData: SentAuthentication" );

                this.handleInitialSocks5AuthenticationHandshakeResponse();
                // Sent final Socks v5 handshake, waiting for final response.
            } else if (this.state === SocksClientState.SentFinalHandshake) {
                log.debug( "processData: SentFinalHandshake" );

                this.handleSocks5FinalHandshakeResponse();
                // Socks BIND established. Waiting for remote connection via proxy.
            } else if (this.state === SocksClientState.BoundWaitingForConnection) {
                log.debug( "processData: BoundWaitingForConnection" );

                if (this.options.proxy.type === 4) {
                    this.handleSocks4IncomingConnectionResponse();
                } else {
                    this.handleSocks5IncomingConnectionResponse();
                }
            } else {
                log.debug( "processData: InternalError" );
                this.closeSocket(ERRORS.InternalError);
                break;
            }
        }
    }

    /**
   * Handles Socket close event.
   * @param had_error
   */
    private onCloseHandler() {
        this.closeSocket(ERRORS.SocketClosed);
    }

    /**
   * Handles Socket error event.
   * @param err
   */
    private onErrorHandler(err: Error) {
        this.closeSocket(err.message);
    }

    /**
   * Removes internal event listeners on the underlying Socket.
   */
    private removeInternalSocketHandlers() {
    // Pauses data flow of the socket (this is internally resumed after 'established' is emitted)
        this.socket.pause();
        this.socket.removeListener("data", this.onDataReceived);
        this.socket.removeListener("close", this.onClose);
        this.socket.removeListener("error", this.onError);
        this.socket.removeListener("connect", this.onConnect);
    }

    /**
   * Closes and destroys the underlying Socket. Emits an error event.
   * @param err { String } An error string to include in error event.
   */
    private closeSocket(err: string) {
    // Make sure only one 'error' event is fired for the lifetime of this SocksClient instance.
        if (this.state !== SocksClientState.Error) {
            // Set internal state to Error.
            this.setState(SocksClientState.Error);

            // Destroy Socket
            this.socket.destroy();

            // Remove internal listeners
            this.removeInternalSocketHandlers();

            // Fire 'error' event.
            this.emit("error", new SocksClientError(err, this.options));
        }
    }

    /**
   * Sends initial Socks v4 handshake request.
   */
    private sendSocks4InitialHandshake() {
        const userId = this.options.proxy.userId || "";

        const buff = new SmartBuffer();
        buff.writeUInt8(0x04);
        buff.writeUInt8(SocksCommand[this.options.command]);
        buff.writeUInt16BE(this.options.destination.port);

        // Socks 4 (IPv4)
        if (net.isIPv4(this.options.destination.host)) {
            buff.writeBuffer(ip.toBuffer(this.options.destination.host));
            buff.writeStringNT(userId);
            // Socks 4a (hostname)
        } else {
            buff.writeUInt8(0x00);
            buff.writeUInt8(0x00);
            buff.writeUInt8(0x00);
            buff.writeUInt8(0x01);
            buff.writeStringNT(userId);
            buff.writeStringNT(this.options.destination.host);
        }

        this.nextRequiredPacketBufferSize =
      SOCKS_INCOMING_PACKET_SIZES.Socks4Response;
        this.socket.write(buff.toBuffer());
    }

    /**
   * Handles Socks v4 handshake response.
   * @param data
   */
    private handleSocks4FinalHandshakeResponse() {
        const data = this.receiveBuffer.get(8);

        if (data[1] !== Socks4Response.Granted) {
            this.closeSocket(
                `${ERRORS.Socks4ProxyRejectedConnection} - (${
                    Socks4Response[data[1]]
                })`,
            );
        } else {
            // Bind response
            if (SocksCommand[this.options.command] === SocksCommand.bind) {
                const buff = SmartBuffer.fromBuffer(data);
                buff.readOffset = 2;

                const remoteHost: SocksRemoteHost = {
                    port: buff.readUInt16BE(),
                    host: ip.fromLong(buff.readUInt32BE()),
                };

                // If host is 0.0.0.0, set to proxy host.
                if (remoteHost.host === "0.0.0.0") {
                    remoteHost.host = this.options.proxy.ipaddress;
                }
                this.setState(SocksClientState.BoundWaitingForConnection);
                this.emit("bound", {remoteHost, socket: this.socket});

                // Connect response
            } else {
                this.setState(SocksClientState.Established);
                this.removeInternalSocketHandlers();
                this.emit("established", {socket: this.socket});
            }
        }
    }

    /**
   * Handles Socks v4 incoming connection request (BIND)
   * @param data
   */
    private handleSocks4IncomingConnectionResponse() {
        const data = this.receiveBuffer.get(8);

        if (data[1] !== Socks4Response.Granted) {
            this.closeSocket(
                `${ERRORS.Socks4ProxyRejectedIncomingBoundConnection} - (${
                    Socks4Response[data[1]]
                })`,
            );
        } else {
            const buff = SmartBuffer.fromBuffer(data);
            buff.readOffset = 2;

            const remoteHost: SocksRemoteHost = {
                port: buff.readUInt16BE(),
                host: ip.fromLong(buff.readUInt32BE()),
            };

            this.setState(SocksClientState.Established);
            this.removeInternalSocketHandlers();
            this.emit("established", {remoteHost, socket: this.socket});
        }
    }

    /**
   * Sends initial Socks v5 handshake request.
   */
    private sendSocks5InitialHandshake() {
        const buff = new SmartBuffer();
        buff.writeUInt8(0x05);

        // We should only tell the proxy we support user/pass auth if auth info is actually provided.
        // Note: As of Tor v0.3.5.7+, if user/pass auth is an option from the client, by default it will always take priority.
        if (this.options.proxy.userId || this.options.proxy.password) {
            buff.writeUInt8(2);
            buff.writeUInt8(Socks5Auth.NoAuth);
            buff.writeUInt8(Socks5Auth.UserPass);
        } else {
            buff.writeUInt8(1);
            buff.writeUInt8(Socks5Auth.NoAuth);
        }

        this.nextRequiredPacketBufferSize =
      SOCKS_INCOMING_PACKET_SIZES.Socks5InitialHandshakeResponse;
        this.socket.write(buff.toBuffer());
        this.setState(SocksClientState.SentInitialHandshake);
    }

    /**
   * Handles initial Socks v5 handshake response.
   * @param data
   */
    private handleInitialSocks5HandshakeResponse() {
        const data = this.receiveBuffer.get(2);

        if (data[0] !== 0x05) {
            this.closeSocket(ERRORS.InvalidSocks5IntiailHandshakeSocksVersion);
        } else if (data[1] === 0xff) {
            this.closeSocket(ERRORS.InvalidSocks5InitialHandshakeNoAcceptedAuthType);
        } else {
            // If selected Socks v5 auth method is no auth, send final handshake request.
            if (data[1] === Socks5Auth.NoAuth) {
                this.sendSocks5CommandRequest();
                // If selected Socks v5 auth method is user/password, send auth handshake.
            } else if (data[1] === Socks5Auth.UserPass) {
                this.sendSocks5UserPassAuthentication();
            } else {
                this.closeSocket(ERRORS.InvalidSocks5InitialHandshakeUnknownAuthType);
            }
        }
    }

    /**
   * Sends Socks v5 user & password auth handshake.
   *
   * Note: No auth and user/pass are currently supported.
   */
    private sendSocks5UserPassAuthentication() {
        const userId = this.options.proxy.userId || "";
        const password = this.options.proxy.password || "";

        const buff = new SmartBuffer();
        buff.writeUInt8(0x01);
        buff.writeUInt8(Buffer.byteLength(userId));
        buff.writeString(userId);
        buff.writeUInt8(Buffer.byteLength(password));
        buff.writeString(password);

        this.nextRequiredPacketBufferSize =
      SOCKS_INCOMING_PACKET_SIZES.Socks5UserPassAuthenticationResponse;
        this.socket.write(buff.toBuffer());
        this.setState(SocksClientState.SentAuthentication);
    }

    /**
   * Handles Socks v5 auth handshake response.
   * @param data
   */
    private handleInitialSocks5AuthenticationHandshakeResponse() {
        this.setState(SocksClientState.ReceivedAuthenticationResponse);

        const data = this.receiveBuffer.get(2);

        if (data[1] !== 0x00) {
            this.closeSocket(ERRORS.Socks5AuthenticationFailed);
        } else {
            this.sendSocks5CommandRequest();
        }
    }

    /**
   * Sends Socks v5 final handshake request.
   */
    private sendSocks5CommandRequest() {
        const buff = new SmartBuffer();

        buff.writeUInt8(0x05);
        buff.writeUInt8(SocksCommand[this.options.command]);
        buff.writeUInt8(0x00);

        // ipv4, ipv6, domain?
        if (net.isIPv4(this.options.destination.host)) {
            buff.writeUInt8(Socks5HostType.IPv4);
            buff.writeBuffer(ip.toBuffer(this.options.destination.host));
        } else if (net.isIPv6(this.options.destination.host)) {
            buff.writeUInt8(Socks5HostType.IPv6);
            buff.writeBuffer(ip.toBuffer(this.options.destination.host));
        } else {
            buff.writeUInt8(Socks5HostType.Hostname);
            buff.writeUInt8(this.options.destination.host.length);
            buff.writeString(this.options.destination.host);
        }
        buff.writeUInt16BE(this.options.destination.port);

        this.nextRequiredPacketBufferSize =
      SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHeader;
        this.socket.write(buff.toBuffer());
        this.setState(SocksClientState.SentFinalHandshake);
    }

    /**
   * Handles Socks v5 final handshake response.
   * @param data
   */
    private handleSocks5FinalHandshakeResponse() {
    // Peek at available data (we need at least 5 bytes to get the hostname length)
        const header = this.receiveBuffer.peek(5);

        if (header[0] !== 0x05 || header[1] !== Socks5Response.Granted) {
            this.closeSocket(
                `${ERRORS.InvalidSocks5FinalHandshakeRejected} - ${
                    Socks5Response[header[1]]
                }`,
            );
        } else {
            // Read address type
            const addressType = header[3];

            let remoteHost: SocksRemoteHost;
            let buff: SmartBuffer;

            // IPv4
            if (addressType === Socks5HostType.IPv4) {
                // Check if data is available.
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv4;
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(4),
                );

                remoteHost = {
                    host: ip.fromLong(buff.readUInt32BE()),
                    port: buff.readUInt16BE(),
                };

                // If given host is 0.0.0.0, assume remote proxy ip instead.
                if (remoteHost.host === "0.0.0.0") {
                    remoteHost.host = this.options.proxy.ipaddress;
                }

                // Hostname
            } else if (addressType === Socks5HostType.Hostname) {
                const hostLength = header[4];
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHostname(
                    hostLength,
                ); // header + host length + host + port

                // Check if data is available.
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(5), // Slice at 5 to skip host length
                );

                remoteHost = {
                    host: buff.readString(hostLength),
                    port: buff.readUInt16BE(),
                };
                // IPv6
            } else if (addressType === Socks5HostType.IPv6) {
                // Check if data is available.
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv6;
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(4),
                );

                remoteHost = {
                    host: ip.toString(buff.readBuffer(16)),
                    port: buff.readUInt16BE(),
                };
            }

            // We have everything we need
            this.setState(SocksClientState.ReceivedFinalResponse);

            // If using CONNECT, the client is now in the established state.
            if (SocksCommand[this.options.command] === SocksCommand.connect) {
                this.setState(SocksClientState.Established);
                this.removeInternalSocketHandlers();
                this.emit("established", {socket: this.socket});
            } else if (SocksCommand[this.options.command] === SocksCommand.bind) {
                /* If using BIND, the Socks client is now in BoundWaitingForConnection state.
           This means that the remote proxy server is waiting for a remote connection to the bound port. */
                this.setState(SocksClientState.BoundWaitingForConnection);
                this.nextRequiredPacketBufferSize =
          SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHeader;
                this.emit("bound", {remoteHost, socket: this.socket});
                /*
          If using Associate, the Socks client is now Established. And the proxy server is now accepting UDP packets at the
          given bound port. This initial Socks TCP connection must remain open for the UDP relay to continue to work.
        */
            } else if (
                SocksCommand[this.options.command] === SocksCommand.associate
            ) {
                this.setState(SocksClientState.Established);
                this.removeInternalSocketHandlers();
                this.emit("established", {
                    remoteHost,
                    socket: this.socket,
                });
            }
        }
    }

    /**
   * Handles Socks v5 incoming connection request (BIND).
   */
    private handleSocks5IncomingConnectionResponse() {
    // Peek at available data (we need at least 5 bytes to get the hostname length)
        const header = this.receiveBuffer.peek(5);

        if (header[0] !== 0x05 || header[1] !== Socks5Response.Granted) {
            this.closeSocket(
                `${ERRORS.Socks5ProxyRejectedIncomingBoundConnection} - ${
                    Socks5Response[header[1]]
                }`,
            );
        } else {
            // Read address type
            const addressType = header[3];

            let remoteHost: SocksRemoteHost;
            let buff: SmartBuffer;

            // IPv4
            if (addressType === Socks5HostType.IPv4) {
                // Check if data is available.
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv4;
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(4),
                );

                remoteHost = {
                    host: ip.fromLong(buff.readUInt32BE()),
                    port: buff.readUInt16BE(),
                };

                // If given host is 0.0.0.0, assume remote proxy ip instead.
                if (remoteHost.host === "0.0.0.0") {
                    remoteHost.host = this.options.proxy.ipaddress;
                }

                // Hostname
            } else if (addressType === Socks5HostType.Hostname) {
                const hostLength = header[4];
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseHostname(
                    hostLength,
                ); // header + host length + port

                // Check if data is available.
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(5), // Slice at 5 to skip host length
                );

                remoteHost = {
                    host: buff.readString(hostLength),
                    port: buff.readUInt16BE(),
                };
                // IPv6
            } else if (addressType === Socks5HostType.IPv6) {
                // Check if data is available.
                const dataNeeded = SOCKS_INCOMING_PACKET_SIZES.Socks5ResponseIPv6;
                if (this.receiveBuffer.length < dataNeeded) {
                    this.nextRequiredPacketBufferSize = dataNeeded;
                    return;
                }

                buff = SmartBuffer.fromBuffer(
                    this.receiveBuffer.get(dataNeeded).slice(4),
                );

                remoteHost = {
                    host: ip.toString(buff.readBuffer(16)),
                    port: buff.readUInt16BE(),
                };
            }

            this.setState(SocksClientState.Established);
            this.removeInternalSocketHandlers();
            this.emit("established", {remoteHost, socket: this.socket});
        }
    }

    get socksClientOptions(): SocksClientOptions {
        return {
            ...this.options,
        };
    }
}

export {
    SocksClient,
    SocksClientOptions,
    SocksClientChainOptions,
    SocksClientError,
    SocksRemoteHost,
    SocksProxy,
    SocksUDPFrameDetails,
};
