Output examples/develra-demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1120
Set Height 720
Set Padding 28
Set TypingSpeed 35ms
Set Theme { "name": "Whimsy", "black": "#050505", "brightBlack": "#666666", "red": "#ff5c35", "brightRed": "#ff7a59", "green": "#72d9a7", "brightGreen": "#9ce8c3", "yellow": "#ffb454", "brightYellow": "#ffd08a", "blue": "#5bd6d0", "brightBlue": "#7ee8e2", "magenta": "#ae81ff", "brightMagenta": "#c6a7ff", "cyan": "#36d9d3", "brightCyan": "#7de8e4", "white": "#e7e7e7", "brightWhite": "#ffffff", "background": "#050505", "foreground": "#e7e7e7", "selection": "#26333a", "cursor": "#36d9d3" }

Type "cd fixtures/repositories/ts-saas"
Enter
Sleep 700ms
Type "npx --yes develra@0.1.2 scan --no-write"
Enter
Sleep 6s
