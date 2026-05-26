{ pkgs }: {
  deps = [
    pkgs.xorg.libXext
    pkgs.xorg.libxcb
    pkgs.xorg.libX11
    pkgs.dbus
    pkgs.expat
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.mesa
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.at-spi2-atk
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
    pkgs.watchman
    pkgs.nodejs_20
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.git
    pkgs.bash
  ];

  env = {
    LANG = "en_US.UTF-8";
  };
}
