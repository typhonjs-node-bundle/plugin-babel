import PluginLoader from '../loader/PluginLoader.js';

/**
 * Oclif init hook to add PluginHandler to plugin manager.
 *
 * @param {object} options - options of the CLI action.
 *
 * @returns {Promise<void>}
 */
export default async function(options)
{
   try
   {
      globalThis.$$eventbus.trigger('log:debug', `plugin-babel init hook running '${options.id}'.`);

      await globalThis.$$pluginManager.addAsync({ name: PluginLoader.packageName, instance: PluginLoader,
       options: { id: options.id, flagsModule: options.flagsModule } });
   }
   catch (error)
   {
      this.error(error);
   }
}
