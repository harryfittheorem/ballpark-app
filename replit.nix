{ pkgs }: {
  deps = [
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
