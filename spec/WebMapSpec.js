describe('WebMap', function () {
  describe('#loading:', function () {
    var webmap;
    var webmapId = 'c30274dbc5db45ebb67b825951eee23d';

    beforeEach(function () {
      // create container
      var container = document.createElement('div');

      // give container a width/height
      container.setAttribute('style', 'width:500px; height: 500px;');

      // add contianer to body
      document.body.appendChild(container);

      webmap = L.esri.webMap(webmapId, { map: L.map(container) });
    });

    it('webmap metadata should have been loaded successfully.', function (done) {
      webmap.on('metadataLoad', function () {
        expect(webmap.title).to.be.equal('L.esri.WebMap Test Map for Karma');
        expect(webmap.bookmarks.length).to.be.equal(0);
        expect(webmap.portalItem.id).to.be.equal(webmapId);
        done();
      });
    });

    it('webmap should have been loaded successfully.', function (done) {
      webmap.on('load', function () {
        expect(webmap).not.to.be.equal(undefined);
        expect(webmap.layers.length).to.be.equal(6);
        done();
      });
    });
  });
});
