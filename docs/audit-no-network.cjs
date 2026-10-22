/* eslint-disable @typescript-eslint/no-require-imports -- Offline build preload. */
const deny = () => { throw new Error('AUDIT_NETWORK_DISABLED'); };
globalThis.fetch = async () => deny();
for (const name of ['node:http','node:https']) {
  const transport=require(name);
  transport.request=deny;
  transport.get=deny;
}
require('node:tls').connect=deny;
const net=require('node:net');
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args) {
  const first=args[0];
  // Permit local named-pipe IPC only; deny all TCP, including loopback.
  if (typeof first==='string' && first.startsWith('\\\\.\\pipe\\')) return originalConnect.apply(this,args);
  if (first && typeof first==='object' && typeof first.path==='string' && first.path.startsWith('\\\\.\\pipe\\')) return originalConnect.apply(this,args);
  return deny();
};

