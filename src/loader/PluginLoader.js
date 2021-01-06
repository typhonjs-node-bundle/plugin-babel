const { babel }      = require('@rollup/plugin-babel');

const { flags }      = require('@oclif/command');

const s_SKIP_DIRS = ['deploy', 'dist', 'node_modules'];

const s_DEFAULT_CONFIG = {
   babelHelpers: 'bundled',
   presets: [
      [require.resolve('@babel/preset-env'), {
         bugfixes: true,
         shippedProposals: true,
         targets: { esmodules: true }
      }]
   ]
};

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
               plugin: PluginLoader.pluginName,
               flags: {
                  // By default babel is set to true, but if the environment variable `{prefix}_BABEL` is defined as
                  // 'true' or 'false' that will determine the setting for whether Babel is engaged.
                  babel: flags.boolean({
                     'description': '[default: true] Use Babel to transpile Javascript.',
                     'allowNo': true,
                     'default': function()
                     {
                        const envVar = `${global.$$flag_env_prefix}_BABEL`;

                        if (process.env[envVar] === 'true') { return true; }

                        return process.env[envVar] !== 'false';
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
         const config = await PluginLoader._loadConfig(bundleData.cliFlags);

         return babel(config);
      }
   }

   /**
    * Attempt to load a local configuration file or provide the default configuration.
    *
    * @param {object} cliFlags - The CLI flags.
    *
    * @returns {object} Either the default Babel configuration or defer to locally provided configuration files.
    * @private
    */
   static async _loadConfig(cliFlags)
   {
      if (typeof cliFlags['ignore-local-config'] === 'boolean' && cliFlags['ignore-local-config'])
      {
         return s_DEFAULT_CONFIG;
      }

      const hasBabelConfig = await global.$$eventbus.triggerAsync('typhonjs:oclif:system:file:util:config:babel:has',
       global.$$bundler_origCWD, s_SKIP_DIRS);

      if (hasBabelConfig)
      {
         global.$$eventbus.trigger('log:verbose',
          `${PluginLoader.pluginName}: deferring to local Babel configuration file(s).`);

         return { babelHelpers: 'bundled' };
      }
      else
      {
         return s_DEFAULT_CONFIG;
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