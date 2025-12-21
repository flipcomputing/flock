export function ensureEditableMaterialBlock(materialBlock, { force = false } = {}) {
        if (!materialBlock || materialBlock.type !== "material") return;

        const baseColorBlock = materialBlock.getInputTargetBlock?.("BASE_COLOR");
        const alphaBlock = materialBlock.getInputTargetBlock?.("ALPHA");
        const hasRealChild =
                (baseColorBlock && !baseColorBlock.isShadow()) ||
                (alphaBlock && !alphaBlock.isShadow());

        if (!force && (!hasRealChild || !materialBlock.isShadow())) return;

        materialBlock.setShadow(false);
        materialBlock.setMovable(true);
        materialBlock.setDeletable(true);
}
