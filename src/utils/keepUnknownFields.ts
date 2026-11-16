/**
 * Formulare bauen den Datensatz beim Speichern aus ihren Eingabefeldern neu
 * auf. Alles, was das Formular nicht kennt, ging dabei verloren: bei einer
 * Rechnung die Zahlungsangaben, bei einer Sitzung die Unterschriften, dazu
 * jedes Feld, das die Android-Fassung oder eine neuere Version angelegt hat.
 *
 * Diese Funktion legt den neu aufgebauten Datensatz ÜBER den ursprünglichen:
 *
 *  - Felder, die das Formular liefert, gewinnen – auch wenn sie leer sind
 *    (ein geleertes Feld soll leer bleiben).
 *  - Felder, die das Formular nicht liefert, bleiben aus dem Original
 *    erhalten.
 *  - `managedKeys` nennt Felder, die das Formular zwar verwaltet, aber
 *    manchmal ganz weglässt (z. B. die Bankverbindung, wenn alle Bankfelder
 *    leer sind). Fehlen sie im neuen Datensatz, werden sie entfernt, statt
 *    aus dem Original wiederaufzutauchen.
 *  - `nestedKeys` nennt Unterobjekte (z. B. die Adresse), bei denen dieselbe
 *    Regel eine Ebene tiefer gilt: unbekannte Unterfelder bleiben erhalten.
 *
 * Bei einem neuen Datensatz (kein Original) kommt der neue unverändert zurück.
 */
export function keepUnknownFields<T extends object>(
  original: T | null | undefined,
  rebuilt: T,
  options: { managedKeys?: readonly (keyof T)[]; nestedKeys?: readonly (keyof T)[] } = {}
): T {
  if (!original) return rebuilt;

  const result: Record<string, unknown> = { ...(original as Record<string, unknown>) };
  for (const key of options.managedKeys ?? []) {
    delete result[key as string];
  }
  Object.assign(result, rebuilt);

  for (const key of options.nestedKeys ?? []) {
    const before = (original as Record<string, unknown>)[key as string];
    const after = (rebuilt as Record<string, unknown>)[key as string];
    if (isPlainObject(before) && isPlainObject(after)) {
      result[key as string] = { ...before, ...after };
    }
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
