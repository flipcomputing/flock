export const TERRAIN_MAX_CELLS = 32;
export const TERRAIN_FAR_HEIGHT = 50;
export const TERRAIN_SIZE = 100;
export const TERRAIN_SUBDIVISIONS = 64;

function cellHeight(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function terrainGrid(rows) {
  const given = Array.isArray(rows) ? rows.filter(Array.isArray) : [];
  const widest = given.reduce((most, row) => Math.max(most, row.length), 0);
  const rowCount = Math.min(given.length, TERRAIN_MAX_CELLS);
  const columnCount = Math.min(widest, TERRAIN_MAX_CELLS);
  const problems = [];
  if (given.length > TERRAIN_MAX_CELLS || widest > TERRAIN_MAX_CELLS) {
    problems.push({ key: 'map_table_too_big', values: { max: TERRAIN_MAX_CELLS } });
  }
  if (rowCount === 0 || columnCount === 0) {
    return { rows: 1, columns: 1, heights: [[0]], problems };
  }

  let notNumber = null;
  let far = null;
  const heights = given.slice(0, rowCount).map((row, r) =>
    Array.from({ length: columnCount }, (_, c) => {
      const height = cellHeight(row[c]);
      if (height === null) {
        notNumber ??= { row: r, column: c, value: String(row[c] ?? '') };
        return 0;
      }
      if (Math.abs(height) > TERRAIN_FAR_HEIGHT) far ??= { row: r, column: c, value: height };
      return height;
    })
  );
  if (notNumber) problems.push({ key: 'map_table_not_number', values: notNumber });
  if (far) problems.push({ key: 'map_table_far', values: { ...far, max: TERRAIN_FAR_HEIGHT } });
  return { rows: rowCount, columns: columnCount, heights, problems };
}

export function terrainLayout(grid) {
  const longest = Math.max(grid.rows, grid.columns);
  const cell = TERRAIN_SIZE / longest;
  const width = cell * grid.columns;
  const depth = cell * grid.rows;
  return {
    width,
    depth,
    subdivisionsX: Math.max(1, Math.round((TERRAIN_SUBDIVISIONS * grid.columns) / longest)),
    subdivisionsY: Math.max(1, Math.round((TERRAIN_SUBDIVISIONS * grid.rows) / longest)),
  };
}

export function terrainHeightAt(grid, layout, x, z) {
  const u = (x + layout.width / 2) / layout.width;
  const v = 1 - (z + layout.depth / 2) / layout.depth;
  const column = Math.min(grid.columns - 1, Math.max(0, Math.floor(u * grid.columns)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(v * grid.rows)));
  return grid.heights[row][column];
}

export function terrainKey(grid) {
  return JSON.stringify(grid.heights);
}
