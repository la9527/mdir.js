import { Crypto } from "../Crypto";

describe( "Crypto", () => {
    it("Crypto ENCRYPT TEST !!!", () => {        
        const plainText = "TEST1234";
        const result = Crypto.encrypt(plainText);
        expect( Crypto.decrypt( result ) ).toBe( plainText );
    });

    it("Crypto invalid encrypt", () => {
        expect( Crypto.encrypt( null ) ).toBe( null );
    });

    it("Crypto invalid decrypt", () => {
        expect( Crypto.decrypt( "123124123112345323424" ) ).toBe( null );
    });

});
