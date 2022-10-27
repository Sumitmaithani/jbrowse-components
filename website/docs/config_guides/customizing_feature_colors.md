---
id: customizing_feature_colors
title: Customizing feature colors with callbacks and plugins
toplevel: true
---

If you have a color callback that has a lot of logic in it, then using jexl to
express all that logic may be hard. Instead, you can make a small plugin which
adds a function to the jexl language, and call that function in your jexl
callback.

For example, create a file named "myplugin.js" (see also Footnote 1)

```js
// myplugin.js
;(function () {
  class MyPlugin {
    install() {}
    configure(pluginManager) {
      pluginManager.jexl.addFunction('colorFeature', feature => {
        let type = feature.get('type')
        if (type === 'CDS') {
          return 'red'
        } else if (type === 'exon') {
          return 'green'
        } else {
          return 'purple'
        }
      })
    }
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginMyPlugin = {
    default: Plugin,
  }
})()
```

Then put `myplugin.js` in the same folder as your config file, and then you can
use the custom `jexl` function in your config callbacks as follows:

```json
{
  "plugins": [
    {
      "name": "MyPlugin",
      "umdLoc": { "uri": "myplugin.js" }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "my_track",
      "name": "my track",
      "assemblyNames": ["hg19"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "gffLocation": {
          "uri": "volvox.filtered.gff"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "mytrack-LinearBasicDisplay",
          "renderer": {
            "type": "SvgFeatureRenderer",
            "color1": "jexl:colorFeature(feature)"
          }
        }
      ]
    }
  ]
}
```

The feature in the callback is a "SimpleFeature" type object, and you can call
`feature.get('start')`, `feature.get('end')`, `feature.get('refName')`, or
`feature.get('other_attribute')` for e.g. maybe a field in a GFF3 column 9

Footnote 0. See our [no-build plugin
tutorial](/docs/tutorials/no_build_plugin_tutorial/) for more info on setting
up a simple plugin for doing these customizations.

Footnote 1. `myplugin.js` does not have to use the jbrowse-plugin-template if
it is small and self contained like this, and does not import other modules. if
you import other modules from your plugin, then it can be worth it to use the
jbrowse-plugin-template.

Footnote 2. if you are using embedded, there are also other methods of
including plugins, see
https://jbrowse.org/storybook/lgv/main/?path=/story/using-plugins--page