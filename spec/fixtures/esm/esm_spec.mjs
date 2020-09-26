describe('A spec file ending in .mjs', function() {
    it('is imported as an es module', function() {
        // Node probably threw already if we tried to require this file,
        // but check anyway just to be sure.
        expect(function() {
            require('./commonjs_sentinel');
        }).toThrowError(/require is not defined/);
    });
});
