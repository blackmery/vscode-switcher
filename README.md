# Switcher

Switcher for Visual Studio Code.

# Configures

setting.json ( `Ctrl+shift+P, >User Settings` )
```
{
    "switcher.findAllFilesInRootDirectory": false,
    "switcher.findSuffixOrder": [
        ".m",
        ".mm",
        ".cs",
        ".cpp",
        ".cxx",
        ".c++",
        ".cc",
        ".c",
        ".h",
        ".hpp",
        ".hxx",
        ".inc",
        ".inl",
        "-inl.h",
        "_inl.h",
        ".js",
        ".html",
        ".css"
    ]
}
```

keybindings.json ( `Ctrl+shift+P, >Keyboard Shortcuts` )
```
{
    { "key": "alt+o", "command": "extension.switcher.run" }
}
```
