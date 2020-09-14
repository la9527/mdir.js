import { Crypto } from "../Crypto";

describe( "Crypto", () => {
    it("Crypto ENCRYPT TEST !!!", () => {        
        const plainText = "TEST1234";
        const result = Crypto.encrypt(plainText);
        expect( Crypto.decrypt( result ) ).toBe( plainText );
    });
});
