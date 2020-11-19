import {
    getLanguageService,
    HTMLDocument,
    TokenType,
    ScannerState,
    Scanner
} from 'vscode-html-languageservice';
import { isInsideMoustacheTag } from './utils';

const parser = getLanguageService();

/**
 * Parses text as HTML
 */
export function parseHtml(text: string): HTMLDocument {
    const preprocessed = preprocess(text);

    // We can safely only set getText because only this is used for parsing
    const parsedDoc = parser.parseHTMLDocument(<any>{ getText: () => preprocessed });

    return parsedDoc;
}

const createScanner = parser.createScanner as (
    input: string,
    initialOffset?: number,
    initialState?: ScannerState
) => Scanner;

/**
 * scan the text and remove any `>` or `<` that cause the tag to end short,
 */
function preprocess(text: string) {
    let scanner = createScanner(text);
    let token = scanner.scan();
    let currentStartTagStart: number | null = null;

    while (token !== TokenType.EOS) {
        const offset = scanner.getTokenOffset();

        if (token === TokenType.StartTagOpen) {
            currentStartTagStart = offset;
        }

        if (token === TokenType.StartTagClose) {
            if (shouldBlankStartOrEndTagLike(offset)) {
                blankStartOrEndTagLike(offset);
            } else {
                currentStartTagStart = null;
            }
        }

        if (token === TokenType.StartTagSelfClose) {
            currentStartTagStart = null;
        }

        // <Foo checked={a < 1}>
        // https://github.com/microsoft/vscode-html-languageservice/blob/71806ef57be07e1068ee40900ef8b0899c80e68a/src/parser/htmlScanner.ts#L327
        if (
            token === TokenType.Unknown &&
            scanner.getScannerState() === ScannerState.WithinTag &&
            scanner.getTokenText() === '<' &&
            shouldBlankStartOrEndTagLike(offset)
        ) {
            blankStartOrEndTagLike(offset);
        }

        token = scanner.scan();
    }

    return text;

    function shouldBlankStartOrEndTagLike(offset: number) {
        // not null rather than falsy, otherwise it won't work on first tag(0)
        return (
            currentStartTagStart !== null &&
            isInsideMoustacheTag(text, currentStartTagStart, offset)
        );
    }

    function blankStartOrEndTagLike(offset: number) {
        text = text.substring(0, offset) + ' ' + text.substring(offset + 1);
        scanner = createScanner(text, offset, ScannerState.WithinTag);
    }
}
