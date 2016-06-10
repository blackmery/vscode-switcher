# Switcher

for Visual Studio Code.

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
    { "key": "ctrl+shift+c", "command": "extension.switcher.run" }
}
```
