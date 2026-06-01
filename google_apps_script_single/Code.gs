function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('PIN88 - Data & Akses Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
