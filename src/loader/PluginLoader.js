const { babel }      = require('@rollup/plugin-babel');

const { flags }      = require('@oclif/command');

const { FileUtil }   = require('@typhonjs-node-bundle/oclif-commons');

const s_SKIP_DIRS = ['deploy', 'dist', 'node_modules'];

/**
 * Handles interfacing with the plugin manager adding event bindings to pass back a configured
 * instance of `@rollup/plugin-babel` with `@babel/preset-env`.
 */
class PluginLoader
{
   /**
    * Returns the `package.json` module name.
    *
    * @returns {string}
    */
   static get pluginName() { return '@typhonjs-node-rollup/plugin-babel'; }

   /**
    * Returns the rollup plugins managed.
    *
    * @returns {string[]}
    */
   static get rollupPlugins() { return ['@rollup/plugin-babel']; }

   /**
    * Adds flags for various built in commands like `build`.
    *
    * @param {string} command - ID of the command being run.
    * @param {object} eventbus - The eventbus to add flags to.
    */
   static addFlags(command, eventbus)
   {
      switch (command)
      {
         // Add all built in flags for the build command.
         case 'bundle':
            eventbus.trigger('typhonjs:oclif:system:flaghandler:add', {
               command,
               plugin: 'plugin-babel',
               flags: {
                  // By default compress is set to true, but if the environment variable `DEPLOY_COMPRESS` is defined as
                  // 'true' or 'false' that will determine the setting for compress.
                  babel: flags.boolean({
                     'description': '[default: true] Use Babel to transpile latest JS to modern ES modules.',
                     'allowNo': true,
                     'default': function()
                     {
                        if (process.env.DEPLOY_BABEL === 'true') { return true; }

                        return process.env.DEPLOY_BABEL !== 'false';
                     }
                  })
               }
            });
            break;
      }
   }

   /**
    * Returns the configured input plugin for `rollup-plugin-terser`
    *
    * @param {object} bundleData - The CLI config
    * @param {object} bundleData.cliFlags - The CLI flags
    *
    * @param {object} currentBundle - The CLI config
    * @param {object} bundleData.cliFlags - The CLI flags
    *
    * @returns {object} Rollup plugin
    */
   static async getInputPlugin(bundleData = {}, currentBundle = {})
   {
      if (bundleData.cliFlags && bundleData.cliFlags.babel === true && currentBundle.inputType === 'javascript')
      {
         const hasBabelConfig = await FileUtil.hasBabelConfig(global.$$bundler_origCWD, s_SKIP_DIRS);

         if (hasBabelConfig)
         {
            global.$$eventbus.trigger('log:verbose', `plugin-babel: deferring to local Babel configuration file(s).`);

            return babel({ babelHelpers: 'bundled' });
         }
         else
         {
            return babel({
               babelHelpers: 'bundled',
               presets: [
                  [require.resolve('@babel/preset-env'), {
                     bugfixes: true,
                     shippedProposals: true,
                     targets: { esmodules: true }
                  }]
               ]
            });
         }
      }
   }

   /**
    * Wires up PluginHandler on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @see https://www.npmjs.com/package/typhonjs-plugin-manager
    *
    * @ignore
    */
   static onPluginLoad(ev)
   {
      ev.eventbus.on('typhonjs:oclif:bundle:plugins:main:input:get', PluginLoader.getInputPlugin, PluginLoader);

      PluginLoader.addFlags(ev.pluginOptions.id, ev.eventbus);
   }
}

module.exports = PluginLoader;