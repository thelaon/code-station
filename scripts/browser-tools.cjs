const os=require('node:os'),path=require('node:path');
module.exports=require(process.env.CQUIZ_PLAYWRIGHT||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
