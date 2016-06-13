# Switcher

Switcher for Visual Studio Code.

# Configures

setting.json ( `Ctrl+shift+P, >User Settings` )
```
{
    "switcher.findAllFilesInRootDirectory": false,
    "switcher.findExtensionOrder": [
        "cpp",
        "c",
        "h",
        "hpp",
        "inl"
    ]
}
```

keybindings.json ( `Ctrl+shift+P, >Keyboard Shortcuts` )
```
{
    { "key": "alt+o", "command": "extension.switcher.run" }
}
```
