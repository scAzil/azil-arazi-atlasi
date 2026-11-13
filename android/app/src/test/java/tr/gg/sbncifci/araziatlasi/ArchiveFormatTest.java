package tr.gg.sbncifci.araziatlasi;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;

public class ArchiveFormatTest {
    @Test public void sha256MatchesKnownVector(){
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            AtlasStore.sha256("abc".getBytes(StandardCharsets.UTF_8)));
    }
    @Test public void hashNamedAssetsAreRequired(){
        String safe="a".repeat(64)+".jpg";
        assertTrue(ArchiveCodec.validRef(safe));
        assertFalse(ArchiveCodec.validRef("../"+safe));
        assertFalse(ArchiveCodec.validRef("photo.jpg"));
        assertFalse(ArchiveCodec.validRef("a".repeat(64)+".exe"));
    }
}
