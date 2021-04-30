import { babel }           from '@rollup/plugin-babel';

import { createRequire }   from 'module';

const require = createRequire(import.meta.url);

const s_BABEL_CONFIG = new Set(['.babelrc', '.babelrc.cjs', '.babelrc.js', '.babelrc.mjs', '.babelrc.json',
 'babel.config.cjs', 'babel.config.js', 'babel.config.json', 'babel.config.mjs']);

const s_SKIP_DIRS = new Set(['deploy', 'dist', 'node_modules']);

const s_PACKAGE_NAME = '@typhonjs-node-rollup/plugin-babel';
const s_CONFLICT_PACKAGES = ['@rollup/plugin-babel'];

const s_DEFAULT_CONFIG = () =>
{
   return {
      babelHelpers: 'bundled',
      presets: [
         [require.resolve('@babel/preset-env'), {
            bugfixes: true,
            shippedProposals: true,
            targets: { esmodules: true }
         }]
      ]
   };
};

/**
 * Handles interfacing with the plugin manager adding event bindings to pass back a configured
 * instance of `@rollup/plugin-babel` with `@babel/preset-env`.
 */
export default class PluginLoader
{
   /**
    * Returns the any modules that cause a conflict.
    *
    * @returns {string[]} An array of conflicting packages.
    */
   static get conflictPackages() { return s_CONFLICT_PACKAGES; }

   /**
    * Returns the `package.json` module name.
    *
    * @returns {string} Package name.
    */
   static get packageName() { return s_PACKAGE_NAME; }

   /**
    * Adds flags for various built in commands like `build`.
    *
    * @param {object} eventbus - The eventbus to add flags to.
    *
    * @param {object} flags - The Oclif flags module.
    */
   static addFlags(eventbus, flags)
   {
      eventbus.trigger('typhonjs:oclif:handler:flag:add', {
         command: 'bundle',
         pluginName: PluginLoader.packageName,
         flags: {
            // By default babel is set to true, but if the environment variable `{prefix}_BABEL` is defined as
            // 'true' or 'false' that will determine the setting for whether Babel is engaged.
            babel: flags.boolean({
               'description': '[default: true] Use Babel to transpile Javascript.',
               'allowNo': true,
               'default': function(context)
               {
                  const envVars = context === null ? {} : process.env;
                  const envVar = `${globalThis.$$cli_env_prefix}_BABEL`;

                  let defaultValue = true;

                  if (envVar in envVars && envVars[envVar] !== 'true')
                  {
                     defaultValue = false;
                  }

                  return defaultValue;
               }
            })
         }
      });
   }

   /**
    * Returns the configured input plugin for `rollup-plugin-terser`
    *
    * @param {object} bundleData - The CLI config
    * @param {object} bundleData.cliFlags - The CLI flags
    *
    * @param {object} currentBundle - The CLI config
    * @param {object} currentBundle.inputType - Type of source
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
         return s_DEFAULT_CONFIG();
      }

      const hasBabelConfig = await globalThis.$$eventbus.triggerAsync('typhonjs:utils:file:file:has', {
         dir: globalThis.$$bundler_origCWD,
         fileList: s_BABEL_CONFIG,
         skipDir: s_SKIP_DIRS
      });

      if (hasBabelConfig)
      {
         globalThis.$$eventbus.trigger('log:verbose',
          `${PluginLoader.packageName}: deferring to local Babel configuration file(s).`);

         return { babelHelpers: 'bundled' };
      }
      else
      {
         return s_DEFAULT_CONFIG();
      }
   }

   /**
    * Wires up PluginLoader on the plugin eventbus.
    *
    * @param {object} ev - PluginInvokeEvent - The plugin event.
    *
    * @see https://www.npmjs.com/package/@typhonjs-plugin/manager
    *
    * @ignore
    */
   static async onPluginLoad(ev)
   {
      ev.eventbus.on('typhonjs:oclif:bundle:plugins:main:input:get', PluginLoader.getInputPlugin, PluginLoader);

      const flags = await import(ev.pluginOptions.flagsModule);

      PluginLoader.addFlags(ev.eventbus, flags);

      // Add a filter to exclude any errors generating from Babel so the calling code is highlighted.
      ev.eventbus.trigger('typhonjs:util:error:parser:filter:add', {
         type: 'exclusive',
         name: '@babel',
         filterString: '@babel'
      });
   }
}
