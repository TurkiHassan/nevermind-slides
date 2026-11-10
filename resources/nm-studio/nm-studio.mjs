#!/usr/bin/env node

// src/cli/nm-studio.ts
import { readFileSync as readFileSync3, realpathSync as realpathSync2 } from "node:fs";
import { writeFile as writeFile6 } from "node:fs/promises";
import { basename as basename6, dirname as dirname10, resolve as resolve7 } from "node:path";
import { fileURLToPath } from "node:url";

// src/engine/splice.ts
function ordered(splices) {
  return splices.map((s, i2) => ({ s, i: i2 })).sort((a, b) => a.s.start - b.s.start || a.s.end - a.s.start - (b.s.end - b.s.start) || a.i - b.i).map((x) => x.s);
}
function checkSplices(length, splices) {
  const out2 = ordered(splices);
  let pos = 0;
  for (const s of out2) {
    if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end < s.start || s.end > length) {
      throw new RangeError(`invalid splice [${s.start}, ${s.end}) for text of length ${length}`);
    }
    if (s.start < pos) throw new RangeError(`overlapping splice [${s.start}, ${s.end}) (previous splice ends at ${pos})`);
    pos = s.end;
  }
  return out2;
}
function applySplices(text, splices) {
  if (splices.length === 0) return text;
  const out2 = [];
  let pos = 0;
  for (const s of checkSplices(text.length, splices)) {
    out2.push(text.slice(pos, s.start), s.text);
    pos = s.end;
  }
  out2.push(text.slice(pos));
  return out2.join("");
}
function invertSplices(before, splices) {
  let delta = 0;
  const inverse = [];
  for (const s of checkSplices(before.length, splices)) {
    const start = s.start + delta;
    inverse.push({ start, end: start + s.text.length, text: before.slice(s.start, s.end) });
    delta += s.text.length - (s.end - s.start);
  }
  return inverse;
}

// node_modules/parse5/dist/common/unicode.js
var UNDEFINED_CODE_POINTS = /* @__PURE__ */ new Set([
  65534,
  65535,
  131070,
  131071,
  196606,
  196607,
  262142,
  262143,
  327678,
  327679,
  393214,
  393215,
  458750,
  458751,
  524286,
  524287,
  589822,
  589823,
  655358,
  655359,
  720894,
  720895,
  786430,
  786431,
  851966,
  851967,
  917502,
  917503,
  983038,
  983039,
  1048574,
  1048575,
  1114110,
  1114111
]);
var REPLACEMENT_CHARACTER = "\uFFFD";
var CODE_POINTS;
(function(CODE_POINTS2) {
  CODE_POINTS2[CODE_POINTS2["EOF"] = -1] = "EOF";
  CODE_POINTS2[CODE_POINTS2["NULL"] = 0] = "NULL";
  CODE_POINTS2[CODE_POINTS2["TABULATION"] = 9] = "TABULATION";
  CODE_POINTS2[CODE_POINTS2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
  CODE_POINTS2[CODE_POINTS2["LINE_FEED"] = 10] = "LINE_FEED";
  CODE_POINTS2[CODE_POINTS2["FORM_FEED"] = 12] = "FORM_FEED";
  CODE_POINTS2[CODE_POINTS2["SPACE"] = 32] = "SPACE";
  CODE_POINTS2[CODE_POINTS2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
  CODE_POINTS2[CODE_POINTS2["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
  CODE_POINTS2[CODE_POINTS2["AMPERSAND"] = 38] = "AMPERSAND";
  CODE_POINTS2[CODE_POINTS2["APOSTROPHE"] = 39] = "APOSTROPHE";
  CODE_POINTS2[CODE_POINTS2["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
  CODE_POINTS2[CODE_POINTS2["SOLIDUS"] = 47] = "SOLIDUS";
  CODE_POINTS2[CODE_POINTS2["DIGIT_0"] = 48] = "DIGIT_0";
  CODE_POINTS2[CODE_POINTS2["DIGIT_9"] = 57] = "DIGIT_9";
  CODE_POINTS2[CODE_POINTS2["SEMICOLON"] = 59] = "SEMICOLON";
  CODE_POINTS2[CODE_POINTS2["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
  CODE_POINTS2[CODE_POINTS2["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
  CODE_POINTS2[CODE_POINTS2["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
  CODE_POINTS2[CODE_POINTS2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
  CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_A"] = 65] = "LATIN_CAPITAL_A";
  CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_Z"] = 90] = "LATIN_CAPITAL_Z";
  CODE_POINTS2[CODE_POINTS2["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
  CODE_POINTS2[CODE_POINTS2["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
  CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_A"] = 97] = "LATIN_SMALL_A";
  CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_Z"] = 122] = "LATIN_SMALL_Z";
})(CODE_POINTS || (CODE_POINTS = {}));
var SEQUENCES = {
  DASH_DASH: "--",
  CDATA_START: "[CDATA[",
  DOCTYPE: "doctype",
  SCRIPT: "script",
  PUBLIC: "public",
  SYSTEM: "system"
};
function isSurrogate(cp) {
  return cp >= 55296 && cp <= 57343;
}
function isSurrogatePair(cp) {
  return cp >= 56320 && cp <= 57343;
}
function getSurrogatePairCodePoint(cp1, cp2) {
  return (cp1 - 55296) * 1024 + 9216 + cp2;
}
function isControlCodePoint(cp) {
  return cp !== 32 && cp !== 10 && cp !== 13 && cp !== 9 && cp !== 12 && cp >= 1 && cp <= 31 || cp >= 127 && cp <= 159;
}
function isUndefinedCodePoint(cp) {
  return cp >= 64976 && cp <= 65007 || UNDEFINED_CODE_POINTS.has(cp);
}

// node_modules/parse5/dist/common/error-codes.js
var ERR;
(function(ERR2) {
  ERR2["controlCharacterInInputStream"] = "control-character-in-input-stream";
  ERR2["noncharacterInInputStream"] = "noncharacter-in-input-stream";
  ERR2["surrogateInInputStream"] = "surrogate-in-input-stream";
  ERR2["nonVoidHtmlElementStartTagWithTrailingSolidus"] = "non-void-html-element-start-tag-with-trailing-solidus";
  ERR2["endTagWithAttributes"] = "end-tag-with-attributes";
  ERR2["endTagWithTrailingSolidus"] = "end-tag-with-trailing-solidus";
  ERR2["unexpectedSolidusInTag"] = "unexpected-solidus-in-tag";
  ERR2["unexpectedNullCharacter"] = "unexpected-null-character";
  ERR2["unexpectedQuestionMarkInsteadOfTagName"] = "unexpected-question-mark-instead-of-tag-name";
  ERR2["invalidFirstCharacterOfTagName"] = "invalid-first-character-of-tag-name";
  ERR2["unexpectedEqualsSignBeforeAttributeName"] = "unexpected-equals-sign-before-attribute-name";
  ERR2["missingEndTagName"] = "missing-end-tag-name";
  ERR2["unexpectedCharacterInAttributeName"] = "unexpected-character-in-attribute-name";
  ERR2["unknownNamedCharacterReference"] = "unknown-named-character-reference";
  ERR2["missingSemicolonAfterCharacterReference"] = "missing-semicolon-after-character-reference";
  ERR2["unexpectedCharacterAfterDoctypeSystemIdentifier"] = "unexpected-character-after-doctype-system-identifier";
  ERR2["unexpectedCharacterInUnquotedAttributeValue"] = "unexpected-character-in-unquoted-attribute-value";
  ERR2["eofBeforeTagName"] = "eof-before-tag-name";
  ERR2["eofInTag"] = "eof-in-tag";
  ERR2["missingAttributeValue"] = "missing-attribute-value";
  ERR2["missingWhitespaceBetweenAttributes"] = "missing-whitespace-between-attributes";
  ERR2["missingWhitespaceAfterDoctypePublicKeyword"] = "missing-whitespace-after-doctype-public-keyword";
  ERR2["missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers"] = "missing-whitespace-between-doctype-public-and-system-identifiers";
  ERR2["missingWhitespaceAfterDoctypeSystemKeyword"] = "missing-whitespace-after-doctype-system-keyword";
  ERR2["missingQuoteBeforeDoctypePublicIdentifier"] = "missing-quote-before-doctype-public-identifier";
  ERR2["missingQuoteBeforeDoctypeSystemIdentifier"] = "missing-quote-before-doctype-system-identifier";
  ERR2["missingDoctypePublicIdentifier"] = "missing-doctype-public-identifier";
  ERR2["missingDoctypeSystemIdentifier"] = "missing-doctype-system-identifier";
  ERR2["abruptDoctypePublicIdentifier"] = "abrupt-doctype-public-identifier";
  ERR2["abruptDoctypeSystemIdentifier"] = "abrupt-doctype-system-identifier";
  ERR2["cdataInHtmlContent"] = "cdata-in-html-content";
  ERR2["incorrectlyOpenedComment"] = "incorrectly-opened-comment";
  ERR2["eofInScriptHtmlCommentLikeText"] = "eof-in-script-html-comment-like-text";
  ERR2["eofInDoctype"] = "eof-in-doctype";
  ERR2["nestedComment"] = "nested-comment";
  ERR2["abruptClosingOfEmptyComment"] = "abrupt-closing-of-empty-comment";
  ERR2["eofInComment"] = "eof-in-comment";
  ERR2["incorrectlyClosedComment"] = "incorrectly-closed-comment";
  ERR2["eofInCdata"] = "eof-in-cdata";
  ERR2["absenceOfDigitsInNumericCharacterReference"] = "absence-of-digits-in-numeric-character-reference";
  ERR2["nullCharacterReference"] = "null-character-reference";
  ERR2["surrogateCharacterReference"] = "surrogate-character-reference";
  ERR2["characterReferenceOutsideUnicodeRange"] = "character-reference-outside-unicode-range";
  ERR2["controlCharacterReference"] = "control-character-reference";
  ERR2["noncharacterCharacterReference"] = "noncharacter-character-reference";
  ERR2["missingWhitespaceBeforeDoctypeName"] = "missing-whitespace-before-doctype-name";
  ERR2["missingDoctypeName"] = "missing-doctype-name";
  ERR2["invalidCharacterSequenceAfterDoctypeName"] = "invalid-character-sequence-after-doctype-name";
  ERR2["duplicateAttribute"] = "duplicate-attribute";
  ERR2["nonConformingDoctype"] = "non-conforming-doctype";
  ERR2["missingDoctype"] = "missing-doctype";
  ERR2["misplacedDoctype"] = "misplaced-doctype";
  ERR2["endTagWithoutMatchingOpenElement"] = "end-tag-without-matching-open-element";
  ERR2["closingOfElementWithOpenChildElements"] = "closing-of-element-with-open-child-elements";
  ERR2["disallowedContentInNoscriptInHead"] = "disallowed-content-in-noscript-in-head";
  ERR2["openElementsLeftAfterEof"] = "open-elements-left-after-eof";
  ERR2["abandonedHeadElementChild"] = "abandoned-head-element-child";
  ERR2["misplacedStartTagForHeadElement"] = "misplaced-start-tag-for-head-element";
  ERR2["nestedNoscriptInHead"] = "nested-noscript-in-head";
  ERR2["eofInElementThatCanContainOnlyText"] = "eof-in-element-that-can-contain-only-text";
})(ERR || (ERR = {}));

// node_modules/parse5/dist/tokenizer/preprocessor.js
var DEFAULT_BUFFER_WATERLINE = 1 << 16;
var Preprocessor = class {
  constructor(handler) {
    this.handler = handler;
    this.html = "";
    this.pos = -1;
    this.lastGapPos = -2;
    this.gapStack = [];
    this.skipNextNewLine = false;
    this.lastChunkWritten = false;
    this.endOfChunkHit = false;
    this.bufferWaterline = DEFAULT_BUFFER_WATERLINE;
    this.isEol = false;
    this.lineStartPos = 0;
    this.droppedBufferSize = 0;
    this.line = 1;
    this.lastErrOffset = -1;
  }
  /** The column on the current line. If we just saw a gap (eg. a surrogate pair), return the index before. */
  get col() {
    return this.pos - this.lineStartPos + Number(this.lastGapPos !== this.pos);
  }
  /** The index in `html` at which the current code point starts (the high surrogate of a pair). */
  get codePointStart() {
    return this.pos - Number(this.lastGapPos === this.pos);
  }
  /** The offset of the current code point, before the second unit of a surrogate pair. */
  get offset() {
    return this.droppedBufferSize + this.codePointStart;
  }
  getError(code, cpOffset) {
    const { line, col, offset: offset2 } = this;
    const startCol = col + cpOffset;
    const startOffset = offset2 + cpOffset;
    return {
      code,
      startLine: line,
      endLine: line,
      startCol,
      endCol: startCol,
      startOffset,
      endOffset: startOffset
    };
  }
  _err(code) {
    if (this.handler.onParseError && this.lastErrOffset !== this.offset) {
      this.lastErrOffset = this.offset;
      this.handler.onParseError(this.getError(code, 0));
    }
  }
  _addGap() {
    this.gapStack.push(this.lastGapPos);
    this.lastGapPos = this.pos;
  }
  _processSurrogate(cp) {
    if (this.pos !== this.html.length - 1) {
      const nextCp = this.html.charCodeAt(this.pos + 1);
      if (!isSurrogatePair(cp) && isSurrogatePair(nextCp)) {
        this.pos++;
        this._addGap();
        return getSurrogatePairCodePoint(cp, nextCp);
      }
    } else if (!this.lastChunkWritten) {
      this.endOfChunkHit = true;
      return CODE_POINTS.EOF;
    }
    this._err(ERR.surrogateInInputStream);
    return cp;
  }
  willDropParsedChunk() {
    return this.pos > this.bufferWaterline;
  }
  /**
   * Drop the parsed input, except for the current code point and the `keep` code units before it. The gap history is
   * reset, so the kept units must contain no preprocessing gap.
   */
  dropParsedChunk(keep = 0) {
    if (this.willDropParsedChunk()) {
      const droppedSize = this.offset - this.droppedBufferSize - keep;
      this.html = this.html.substring(droppedSize);
      this.lineStartPos -= droppedSize;
      this.droppedBufferSize += droppedSize;
      this.pos -= droppedSize;
      this.lastGapPos = -2;
      this.gapStack.length = 0;
      if (this.pos > keep)
        this._addGap();
    }
  }
  write(chunk, isLastChunk) {
    if (this.html.length > 0) {
      this.html += chunk;
    } else {
      this.html = chunk;
    }
    this.endOfChunkHit = false;
    this.lastChunkWritten = isLastChunk;
  }
  insertHtmlAtCurrentPos(chunk) {
    this.html = this.html.substring(0, this.pos + 1) + chunk + this.html.substring(this.pos + 1);
    this.endOfChunkHit = false;
  }
  startsWith(pattern, caseSensitive) {
    if (this.pos + pattern.length > this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return false;
    }
    if (caseSensitive) {
      return this.html.startsWith(pattern, this.pos);
    }
    for (let i2 = 0; i2 < pattern.length; i2++) {
      const cp = this.html.charCodeAt(this.pos + i2) | 32;
      if (cp !== pattern.charCodeAt(i2)) {
        return false;
      }
    }
    return true;
  }
  peek(offset2) {
    const pos = this.pos + offset2;
    if (pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    const code = this.html.charCodeAt(pos);
    return code === CODE_POINTS.CARRIAGE_RETURN ? CODE_POINTS.LINE_FEED : code;
  }
  advance() {
    this.pos++;
    if (this.isEol) {
      this.isEol = false;
      this.line++;
      this.lineStartPos = this.pos;
    }
    if (this.pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    let cp = this.html.charCodeAt(this.pos);
    if (cp === CODE_POINTS.CARRIAGE_RETURN) {
      this.isEol = true;
      this.skipNextNewLine = true;
      return CODE_POINTS.LINE_FEED;
    }
    if (cp === CODE_POINTS.LINE_FEED) {
      this.isEol = true;
      if (this.skipNextNewLine) {
        this.line--;
        this.skipNextNewLine = false;
        this._addGap();
        return this.advance();
      }
    }
    this.skipNextNewLine = false;
    if (isSurrogate(cp)) {
      cp = this._processSurrogate(cp);
    }
    const isCommonValidRange = this.handler.onParseError === null || cp > 31 && cp < 127 || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.CARRIAGE_RETURN || cp > 159 && cp < 64976;
    if (!isCommonValidRange) {
      this._checkForProblematicCharacters(cp);
    }
    return cp;
  }
  _checkForProblematicCharacters(cp) {
    if (isControlCodePoint(cp)) {
      this._err(ERR.controlCharacterInInputStream);
    } else if (isUndefinedCodePoint(cp)) {
      this._err(ERR.noncharacterInInputStream);
    }
  }
  retreat(count) {
    this.pos -= count;
    while (this.pos < this.lastGapPos) {
      this.lastGapPos = this.gapStack.pop();
      this.pos--;
    }
    this.isEol = false;
  }
};

// node_modules/parse5/dist/common/token.js
var TokenType;
(function(TokenType4) {
  TokenType4[TokenType4["CHARACTER"] = 0] = "CHARACTER";
  TokenType4[TokenType4["NULL_CHARACTER"] = 1] = "NULL_CHARACTER";
  TokenType4[TokenType4["WHITESPACE_CHARACTER"] = 2] = "WHITESPACE_CHARACTER";
  TokenType4[TokenType4["START_TAG"] = 3] = "START_TAG";
  TokenType4[TokenType4["END_TAG"] = 4] = "END_TAG";
  TokenType4[TokenType4["COMMENT"] = 5] = "COMMENT";
  TokenType4[TokenType4["DOCTYPE"] = 6] = "DOCTYPE";
  TokenType4[TokenType4["EOF"] = 7] = "EOF";
  TokenType4[TokenType4["HIBERNATION"] = 8] = "HIBERNATION";
})(TokenType || (TokenType = {}));
function getTokenAttr(token, attrName) {
  for (let i2 = token.attrs.length - 1; i2 >= 0; i2--) {
    if (token.attrs[i2].name === attrName) {
      return token.attrs[i2].value;
    }
  }
  return null;
}

// node_modules/entities/dist/decode-codepoint.js
var c1 = [
  8364,
  0,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  0,
  381,
  0,
  0,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  0,
  382,
  376
];
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeData = ["Q=\xA8`p0AEligMPacutebrevecircyfrgravelphamacrndogonpfpplyFunctionringscrsigntildeumlBackslashrvwedcyecausernoullistafropfrevescrumpeqCHcyOPYacutepitalDifferentialDyleyscaronedilirconintdotedillanterDotfrhiircleDotMinusPlusTimeslockwiseContourIntegralseCurlyDoubleQuoteQuoteolonengruentinttourIntegralpfroductunterClockwiseContourIntegralrossscrupCapDDotrahdJcyScyZcyaggerrrshvcaronyeltafriacriticalAcuteDotubleAcuteGraveTildemondfferentialDopftDotEqualubleContourIntegralDotwnArrowLeftArrowRightArrowTeeongLeftArrowRightArrowRightArrowRightArrowTeeUpArrowDownArrowVerticalBarwnArrowBarUpArrowBreveLeftRightVectorTeeVectorVectorBarRightTeeVectorVectorBarTeeArrowarrowscrtrokENGTHacutecaronircydotfrgravelementmacrptySmallSquareVerySmallSquareogonpfpsilonqualTildeilibriumscrimtaumlxistsponentialEFcyfrilledSmallSquareVerySmallSquareopfrAlluriertrfscrGJcyTammadbrevecedilircydotfrgopfreaterEqualLessFullEqualGreaterLessSlantEqualTildescrtHARDcyacektcircfrilbertSpaceopfrizontalLinescrtrokumpDownHumpEqualIEcyJligOcyacutecircydotfrgravemacrginaryIpliesntegralrsectionvisibleCommaTimesogonpftascrtildeukcymlJcircyfropfscrercyukcyKHcyJcyappacedilyfropfscrLJcyTacutembdangplacetrfrrcaronedilyeftAngleBracketrrowBarRightArrowCeilingDoubleBracketwnTeeVectorVectorBarFloorRightArrowVectorTeeArrowVectorriangleBarEqualUpDownVectorTeeVectorVectorBarVectorBararrowrightarrowssEqualGreaterFullEqualGreaterLessSlantEqualTildefrleftarrowmidotongLeftArrowRightArrowRightArrowleftarrowrightarrowrightarrowpfwerLeftArrowRightArrowscrhtroktMapcyediumSpacellintrffrinusPlusopfscruNJcyacutecaronedilyegativeMediumSpaceThickSpacenSpaceVeryThinSpacestedGreaterGreaterLessLesswLinefroBreaknBreakingSpacepftCongruentupCapDoubleVerticalBarElementqualTildexistsGreaterEqualFullEqualGreaterLessSlantEqualTildeHumpDownHumpEqualLeftTriangleBarEqualssEqualGreaterLessSlantEqualTildeNestedGreaterGreaterLessLessPrecedesEqualSlantEqualReverseElementightTriangleBarEqualSquareSubsetEqualpersetEqualubsetEqualcceedsEqualSlantEqualTildepersetEqualTildeEqualFullEqualTildeVerticalBarscrtildeuOEligacutecircydblacfrgravemacregaicronopfpenCurlyDoubleQuoteQuoterscrlashtildemesumlverBarraceketParenthesisPartialDcyfrhiilusMinusoincareplanepfrecedesEqualSlantEqualTildeimeoductportionalscriQUOTfropfscrRBarrEGacutengrrtlcaronedilyeverseElementquilibriumUpEquilibriumfrhoightAngleBracketrrowBarLeftArrowCeilingDoubleBracketwnTeeVectorVectorBarFloorTeeArrowVectorriangleBarEqualUpDownVectorTeeVectorVectorBarVectorBararrowopfundImpliesrightarrowscrhuleDelayedSHCHcycyOFTcyacutecaronedilircyfrhortDownArrowLeftArrowRightArrowUpArrowigmamallCircleopfqrtuareIntersectionSubsetEqualpersetEqualUnionscrtarubsetEqualcceedsEqualSlantEqualTildehThatmpersetEqualsetTHORNRADESHcycyabucaronedilyfrhereforetaickSpacenSpaceildeEqualFullEqualTildeopfripleDotscrtrokUacuterrocirbrcyevecircydblacfrgravemacrnderBarraceketParenthesisionPlusogonpfpArrowBarDownArrowDownArrowEquilibriumTeeArrowarrowdownarrowperLeftArrowRightArrowsilonringscrtildeumlVDashbarcydashleerbarticalBarLineSeparatorTildeyThinSpacefropfscrvdashWcircedgefropfscrXfriopfscrYAcyIcyUcyacutecircyfropfscrumlZHcyacutecaronydoteroWidthSpacetafropfscraacutebrevecEdircuteyeligfrgravelefsymphphamacrlgpndanddslopevgelemsdaabcdefghrtvbdsphtzarrogonpfpEacireidosproxeqringscrtympeqtildeumlwconintintbNotackcongepsilonprimesimeqrveewedgebrktbrkcongydquoecausemptyvpsirnoutahweenfrigcapircupodotplustimessqcuptartriangledownupuplusveewedgekarowlacklozengesquaretriangledownleftrightnkk12434ocknequivotopfttomwtiexDLRlrHDUduULRlrVHLRhlrboxdLRlrhDUduminusplustimesuLRlrvHLRhlrprimerevevbarscremiimeolbhsubulletmpEeqcacutepandbrcupcapupdotsretoncapsronedilircupssmdotedilmptyvnterdotfrhcyeckmarkiirEceqlearrowleftrightdRSastcircdashefnintmidscirlubsuitoloneqmmatpfnlementxesngdotintpfrodysrrarrossscrubepetdotudarrlreprsclarrppbrcapcapupdotorsrarrmlyeqprecsuccveewedgerenvearrowleftrightveewedwconintintylctydArrHaraggerlethrrshvbkarowlaccaronydaggerrrotseqegltamptyvfishtrharlriamondsuitsegammasinvideontimesonxjcylcornropollarpfteqdotminusplussquareublebarwedgewnarrowdownarrowsharpoonleftrightrbkarowcornropscryoltroktdotrifuarrharwanglezcyigrarreDDototacutestercaronircolonydotefDotrgravesdotlinterslsdotmacrptysetvsp134ngspogonpfparsllussilonvqcircolonsimlantgtrlessualsestivDDvparslrDotarrscrdotimtahumlroxclistpectationonentialefallingdotseqcyemalefiligligligriligjliglatligtnsnofopfrallkvpartintrac123456823534584556878slownscrgElacutemmadpbrevecircydotelqqslantsccdotollesfrggimeljcylEajnEapproxeqqsimopfravescrimeltccirdotlParquestrapproxrrdoteqlessqlesslesssimvertneqqnEhArrairsplfmiltrdcyrcirwbarcirceartsuitlliprconfrksearowwarowoarrmthtokleftarrowrightarrowpfrbarscrlashtrokybullpheniacutecircyecyxclffrgraveiiintntnfinotajligmacrgelinepartthofpedncarefintieodottcalegersrcallarhkprodocygonpftaprodquestscrinEdotsvvtildeukcymljcircyfrmathopfscrercyukcykappavcedilyfrgreenhcyjcyopfscrlAarrrrtailBarrEgHaracuteemptyvgranmbdangdlepquorrbfsfshklpplsimtltailesbarrbrkracekkeslducaronedililubydcaquorrdharusharsheftarrowtailharpoondownupleftarrowsrightarrowsharpoonssquigarrowthreetimesgqqslantsccdotorgessapproxdoteqgtrqgtrgtrsimfishtloorrgEhardulblkjcylarrcornerhardtrimidotoustachenEapproxeqqsimoangrrbrkngleftarrowrightarrowmapstorightarrowoparrowleftrightparflustimeswastbarzengefparltrarrcornerhardmtrisaquocrhimegqbuortroktccirdothreeimeslarrquestrPariefurdsharuharvertneqqnEmDDotacrletesepstodownleftuprkercommaydasheasuredanglefrhoicrodastcirdotnusbdulcpdrnplusodelspfpscrtposultimapmapnGgtvLeftarrowrightarrowltvRightarrowVDashdashablacutengpEidosproxturalsbspumpecapronedilongdotupydasheArrarhkrowdotquivsearimxistsfrgEeqqslantssimtrhArrarrparisdvjcylArrEarrdreftarrowrightarrowqqslantsssimtriemidopftinEdotvabcnivabcparallelsltolintrcueeceqrArrarrcwightarrowtriesccueerhortmidparallelimeqmidparqsubepeubEeseteqqcceqpEeseteqqtglildelgrianglelefteqrightequmerospvDashHarrapdashgetinfinlArretrierArrtriesimwArrarhkrownearoSacutestcircydashblacivotsoldeligfcirrgonravethbarmintlarrcirrossinetmacregaicrondnusopfparerplusrarrderoffmigoforslopevscrlasholtildemesasumlvbarparallelsimltcyercntiodmilptenkfrhivmmatoneitchforkvlanckhkvusacirbcirdouemnsimtwomointintpfundrEapcueecapproxcurlyeqeqnapproxeqqsimsimimesnEapsimodfalarlinesurfptosimurelscriuncspqfrintopfprimescruaternionsintesteqotrAarrrrtailBarrHaraceutedicemptyvngdelequorrapbfscfshklpplsimtlwtailionalsbarrbrkracekkeslducaronedililubydcaldharquorshealinepartsctgfishtloorrhardulovightarrowtailharpoondownupleftarrowsharpoonsrightarrowssquigarrowthreetimesngsingdotseqlarrharmmoustachenmidoangrrbrkparflustimespargtpolintrarrsaquocrhqbuorthreeimesriefltriuluharxsacutebquocEaproncueedilircnEapsimpolintsimydotbeeArrarhkrowctmiswartminusnxtfrownharpchcyyortmidparallelyigmafvmdoteqgElEneplusrarrlarrmallsetminusshpeparslidletesoftcylbarpfpadesuitrqcapsupssubeseteqpesetequareffrarrscretmnmiletarftarfraightepsilonphinsubEdotedotmultnEeplusrarrseteqqneqqimubpccapproxcurlyeqeqnapproxeqqsimsimmngp123EdotsubedothsolublarrmultnEeplusseteqqneqqimubpwArrarhkrownwarzligtargetubrkcaronedilydotelrecfrhere4foretasymvickapproxsimnspkapsimornildemesbardntoeapbotcirforksaprimeradeiangledownlefteqqrighteqdoteminusplussbtimepeziumscryhcytrokwixtoheadleftarrowrightarrowuArrHaracuterrbrcyevecircydarrblacharfishtrgraveharlrblklcornerroptrimacrlogonpfparrowdownarrowharpoonleftrightlussihlonuparrowsrcornerropingtriscrtdotilderifuarrmlwanglevArrBarvDashangrtrepsilonkappanothingphiiroptorhosigmaubsetneqqpsetneqqthetariangleleftrightcydasheebareqlliprbartfrltrinsubpopfproprtriscrubnEepnEezigzagwcircedbargeqierpfropfpreathscrxcapircupdtrifrhArrarrilArrarrmapnisodotpflustimerArrarrscrqcupuplustriveewedgeyacuteycircyenfricyopfscrucymlzacutecaronydoteetrftafrhcyigrarropfscrwjnjC(D%D($(D'%$$ED($'$'$%$'%E$/D'$F%'D(D&#,%%&&$%$)%+%%$E$F$'$&$(#'D&$(%$&4%($(E'%&%($&$)%*$%$%$+)()')($:&5-($'($%*&&&/%%&)%@$'$F$%&&#%%)$&$&$&$(%%%&$(%$$%&%$E$2.&0,.(.(&'%.$F%$&&&(%6)&+*),---&*/1---)-.&)*+,).%*,&,*'('2+,+)1&'1,)2&'&*('($F%'#&D%D($(E&%$$&$ED($)$'%1(2$'%E$)$'((&+$&%%$%D&$(%-#&$E$3)2$F%'%+$&#'D$$'($$($(%&%$$&$E$$$F$./'*,***'*-*($F$$#)$'%$$'$%$.$&%/$&%'$.'(#'$'$&D(D'%$$&$%D($$%&&*%($%&('+%/,($'%E%%$&$($'E%#(%$$E$F$F%'$'#'$&$'$(%$$E$F$F#'D$$(%'%%%+%%$(%'%$$2(',&,-'*'0).+)1&'('-,)'&*(*)(*/&/('/),))/&')-&'('-%1','*'''-'($E$$%+$($/+-'-',+-'-%E%/(-$&%$%'$$#&$%$-%*$E$+$F$&$$#'$($(%'%$$5+-.)+0%5)+%($E$)%1%%%$&,'(&4&*''+H'(&*-(-L-J-'-M-(&O*H&/2F2((%*(***G*M*(&W,K&+.H.-&1'/3F3(&O2(.I4('H,(().H.-.H(I.(&(+(+,+(&.$FD($$#(D(D'%$$($ED($'%&%($F$6,($$$FE'D(&&D&$)('+&'.#+$%$E$%$$$+$/%%$$%)+(+-+(%&%(&*-%$F%$C'$E$&$F#(D%$(%%%%'%$(%'%$$$%/+-*0$%$%$3)'-&-,(*(0*.,)2&(((&+(+))*0&0((/*,*)0&().&(($&%-$-$&%$$-#)%%$($($$%'%'%&%$$E$0(,(-(*$'$-$F$&%')/))/(+)1()($F$&$%&&)(%)+(+-+(&(%$%$&(+(&&C($'$'%%$%%$$(%'%$$E$+&%%K&)$'(((,(($F$+$F%'C)%%''$'&&D'%$$($ED($'$*)',&(.%&('$'%E$)*&*,%,%.%&((%(%,%/(-%%'&$'$F$(D&#($&$%$'($$%%'&$'*+'+,+(&-$E$F$F$(#($'$E$F$F#F$$$F$F#'$&$&D($'%$$E$F$F$&#'$($(%$$&$0%%$%$&$FC)$($$%D%$E&E&%$D'$$%DD($)&%%&$'&%E$$%&&&$&(&$%$&$&%&&)%*$*$*$*$*$*$*$&%(%*$&&'$&'$'%E$$%$%'%$%%%%%')%D'$F%$%&(%D(D&$*%&#'$*'*'('&*%%'&&)%$&''$'%$$'$()$%(%&%'%%&$&'$E$('&'%&''''(&('&&/.%&(&&&($($.()(+0'0'0(&%%&'$&%%&$E&G%%$F%$&&%'%&'$'$'$&$'$'$'$'$&%'$'$'$&$'$'$'$'$'$'$&&&%'$'$'$&$'$'$'$'$&(&'&(&%'$'$'$&$'$'$'$'$'$'$$($'E'$F%&%%'$%%'$''$&'%%%'$'$($#)%$&&&(&&'%&&&D%&&%$'&&E'%&%&(%$&D'%(E%'($E$&%&('%$$%&$&$'%'..()%*$*&*'*'&$&(&&&'$'(&$'($)$%&($&$'%'))&%%'&&&%E&&F$'%$'%&$F%%'$&$'$$'$))$%&&%%')$%$&(&&'%&&&%&D%')$&+*'(&((F&&.-(%&%&$*%&$(#'$&$(%'%%%%'$$)%&$(%$$$%(&%%(D%%&%($(%D$''$$&'&*''$%$%(%&%$F&)*&&$&$(&&$(%E%$&%(&&(&'&)%/%*'-'..($*%'&&$F&$%%%'$'%%'$$'%&$)$&%)#(%%D(%'$(%%G$%'%$$&$$$'%D$$E'%$&&$$%)%$%$&&$'%&(&($%%'%($$%%%$'%E$&'%%&%%'&'$$(&'%&&**'%'&&&%(%%)$'%&$&%&%%$%E$D&%%$&%&%,&,#0$%$($(%&&&%D$'$G$&%&%&$&$F%'&$'$$*D(($H$($($($'%($G%($($'%'%($'%&%%&$F#%%$$(%&($%$$($'%$$&$$%$%$&$&(%$&%&&)$*$&D'%$E$$%$$'$&$$%$%$%$$%%%''%$&$'$%&$F$'$&%%'$'$D$%%&%%&%'%(%*'%&&&)((&'&&$K%E#'$(%%%'%'&$'&'$$&$'$()&%'%'$E$*&($'%'%.'-%E%'$F%'%'$(%'C)$$E&%$$&E&$%%DD($$%'&%%'%&$'$'&%''''&%%%%&$$%'%&(&%'%$&&&(''&(&'$&%&%E%%$'D($F%%'$'&'$($'$$$%'$'E%#(%$$E$'$F$F%'$'#(($$(%$$E$($&$&$F$F#(%%%'$'$$%$$&$(%)%'%'%%'$'%%$E&%%'$(%'%'%'%'%'&'%%$&&&$'D$'%&%'($&%'&)$$(%'&%%%%$$&%&($%(&(%%$$%*,''..%'-'-1$,+,-'-%$%$&$&(%$&%&&)$*$&D'%&*'&'()''&'&$(%'%D$$%$$''$($%&$&$$%&%)%'%&$(%')'$%%%''%$&$'$%&$'&%%&%.+-')'-%.,(%&&D&&%(%'&&%$&'&$$&'%$'%)%&($%$%&$(%E%$%%'$'$%%&%($%'D$%%&%%&%'%'%'%(%'&$'$'$$*&'$K%E#(D&%%&$'&%$&&)')')%%'$(%$$'$/$E$%D'%$&&&&F&%&($($)$$&%%$($(%E$$$F%'$$%)%&#F%D&D$,(-%D%D&D$-$(%'$'%'%E%$&D&E&%&'%&(%*$D&%F(D$&&&%'%&(F%%%$$'$$%&%''$(%%F%'%'&E%')$$E$E%$&$'D'H&D%&%$&$$'%&%&$$%$&$%$$&$'%D%&%%%$&*(-&$'D'H&D'$%&%$&%($$&$FE$&%(D(F(%)$)$&%(%)$)$$&'('E'D%(%$&&&D'$(E$'%&(D(D%,%&($$%&&&D&D%*)+%%'$($%&%&%((%%%'D'$'F*%,D&%(E&$'D'$'F*%,D$&E'%%%.0%,(1%$$%$&&&%$(%'%E%'%E&D%(%'&D&D'F%'&G%F$'%''$(%%'#%D(%%$&G$%$$'%'%%%%%'$'$'%D$&E'%$$'%$$&$'%&&'%&%$$'%&%(&$&&$F$&%&%&$$%&%$&%(%F$F$%'%%%(%$$&E'%%D(&&)%D&$'#&F$''&&'$&$$%$(&&&&&$&'$E$%&$%'%&$$%*%$$()$'%%%'''$'&'%($'$G%'&'&$$$*%EE&$$%$%%%&%$&$')'*'%'*(&(&'&%&($%%&%&&%%&(''''&$'%%&%'$F%$$(#F$&$F$($F$-'&%&(%E%#(%%%'$'$&$F&&%&%)%%'$'$'%E&%%'%'$(%'$'%'%'%'%'&'%'$%'&%('$'%&%'($&%'&)$$(%'&%%%%$$&%(%&($%%$&'&'''$%%E$$(%'%D$''$($%$&$$,-'(./%(-,+(.(-(-%%%-$'%&%$$()'$'$'&%%&%&&D&&%($&'%%)$'$(%E%$%%&%($$(%'%%'$'$''$)$$#)$'$$%$%%&&%&%$&&%&%%&%&&%)%&%$$&'$'$$'%''$(%E%%%%'%)'$%%$E&&$'%'&$%)(+E$$'($($%$&&&$'$&$'$&$'$&%&'&'$'$/&&%)%%&%%$&$'D$(%$&$'%%E$()&&$$'(D&%(D%&($(&+%'$($(&+%%$&&($&$$'$F%'%'%'$&'$%0+&&%$%&$&&&$'&&'&%'$&'&'&&)%+$)&,$'%'%($%%')'*'%'*(&(&'&%$%%%$F$F$F$&$&&'&&$'&&'(%&'&'&%'$&'&&)%+$)&,$'%'%($$'%''$(%%'D'#)%$$&$(%'%$$&$($E$(('&%(&($%,(&&&%&&&E&$'E&($)%($%%$&%$&&&&&D'&%%$($'%)+'+'/%+$+(0%&&&$&(&'&%&'%)$F&$%&%'$'%1*-#'$&D(%%$'&&D'%$$'%'%&$(%DD($''$%&$()%&&%&$'E$$'%E$)%,%.,(%&%%'$'&%+$()%&&%&%&$F$'%'%%'$$'E%$)#'$&'$$'$(%+&(&*&&'$'(&$'%&('K/D(J/D&('..($%$'$%&&&%%'%'&$$E$'$G'D$F$'$'$F%G(D&F(D$)#($(&%($%'$E$F$$$$%'$F#'%&%%$'$E$'%&$$$'%&$&$&$'%E&&%'$'%&$F%'$(%&$&$(C)&$$'%$D%$E$&$F$F$&E%#)$(%$$&$(%%$E$&$)$F$F$%%%0@0000H8H40H000047P00P@001000@0B0HP@:H9T8P000LB8d@800@I0<110000QQ8400P10030005940@410020000Q02000@0200000@P0101@8000440400000000808000000000@00000000P`0000000040400@0004<000000000008000030000000000P020T400020@0@00000000000000000000000000P0000000400400000400220080000100000000000000000P000000000000P000000@00402000000000@00000000000000000000040000000000000", '\xC6&\xC1\u0102\xC2\u0410\u{1D504}\xC0\u0391\u0100\u2A53\u0104\u{1D538}\u2061\xC5\u{1D49C}\u2254\xC3\xC4\u2216\u2AE7\u2306\u0411\u2235\u212C\u0392\u{1D505}\u{1D539}\u02D8\u212C\u224E\u0427\xA9\u0106\u22D2\u2145\u212D\u010C\xC7\u0108\u2230\u010A\xB8\xB7\u212D\u03A7\u2299\u2296\u2295\u2297\u2232\u201D\u2019\u2237\u2A74\u2261\u222F\u222E\u2102\u2210\u2233\u2A2F\u{1D49E}\u22D3\u224D\u2145\u2911\u0402\u0405\u040F\u2021\u21A1\u2AE4\u010E\u0414\u2207\u0394\u{1D507}\xB4\u02D9\u02DD`\u02DC\u22C4\u2146\u{1D53B}\xA8\u20DC\u2250\u222F\xA8\u21D3\u21D0\u21D4\u2AE4\u27F8\u27FA\u27F9\u21D2\u22A8\u21D1\u21D5\u2225\u2193\u2913\u21F5\u0311\u2950\u295E\u21BD\u2956\u295F\u21C1\u2957\u22A4\u21A7\u21D3\u{1D49F}\u0110\u014A\xD0\xC9\u011A\xCA\u042D\u0116\u{1D508}\xC8\u2208\u0112\u25FB\u25AB\u0118\u{1D53C}\u0395\u2A75\u2242\u21CC\u2130\u2A73\u0397\xCB\u2203\u2147\u0424\u{1D509}\u25FC\u25AA\u{1D53D}\u2200\u2131\u2131\u0403>\u0393\u03DC\u011E\u0122\u011C\u0413\u0120\u{1D50A}\u22D9\u{1D53E}\u2265\u22DB\u2267\u2AA2\u2277\u2A7E\u2273\u{1D4A2}\u226B\u042A\u02C7^\u0124\u210C\u210B\u210D\u2500\u210B\u0126\u224E\u224F\u0415\u0132\u0401\xCD\xCE\u0418\u0130\u2111\xCC\u2111\u012A\u2148\u21D2\u222C\u222B\u22C2\u2063\u2062\u012E\u{1D540}\u0399\u2110\u0128\u0406\xCF\u0134\u0419\u{1D50D}\u{1D541}\u{1D4A5}\u0408\u0404\u0425\u040C\u039A\u0136\u041A\u{1D50E}\u{1D542}\u{1D4A6}\u0409<\u0139\u039B\u27EA\u2112\u219E\u013D\u013B\u041B\u27E8\u2190\u21E4\u21C6\u2308\u27E6\u2961\u21C3\u2959\u230A\u2194\u294E\u22A3\u21A4\u295A\u22B2\u29CF\u22B4\u2951\u2960\u21BF\u2958\u21BC\u2952\u21D0\u21D4\u22DA\u2266\u2276\u2AA1\u2A7D\u2272\u{1D50F}\u22D8\u21DA\u013F\u27F5\u27F7\u27F6\u27F8\u27FA\u27F9\u{1D543}\u2199\u2198\u2112\u21B0\u0141\u226A\u2905\u041C\u205F\u2133\u{1D510}\u2213\u{1D544}\u2133\u039C\u040A\u0143\u0147\u0145\u041D\u200B\u200B\u200B\u200B\u226B\u226A\n\u{1D511}\u2060\xA0\u2115\u2AEC\u2262\u226D\u2226\u2209\u2260\u2242\u0338\u2204\u226F\u2271\u2267\u0338\u226B\u0338\u2279\u2A7E\u0338\u2275\u224E\u0338\u224F\u0338\u22EA\u29CF\u0338\u22EC\u226E\u2270\u2278\u226A\u0338\u2A7D\u0338\u2274\u2AA2\u0338\u2AA1\u0338\u2280\u2AAF\u0338\u22E0\u220C\u22EB\u29D0\u0338\u22ED\u228F\u0338\u22E2\u2290\u0338\u22E3\u2282\u20D2\u2288\u2281\u2AB0\u0338\u22E1\u227F\u0338\u2283\u20D2\u2289\u2241\u2244\u2247\u2249\u2224\u{1D4A9}\xD1\u039D\u0152\xD3\xD4\u041E\u0150\u{1D512}\xD2\u014C\u03A9\u039F\u{1D546}\u201C\u2018\u2A54\u{1D4AA}\xD8\xD5\u2A37\xD6\u203E\u23DE\u23B4\u23DC\u2202\u041F\u{1D513}\u03A6\u03A0\xB1\u210C\u2119\u2ABB\u227A\u2AAF\u227C\u227E\u2033\u220F\u2237\u221D\u{1D4AB}\u03A8"\u{1D514}\u211A\u{1D4AC}\u2910\xAE\u0154\u27EB\u21A0\u2916\u0158\u0156\u0420\u211C\u220B\u21CB\u296F\u211C\u03A1\u27E9\u2192\u21E5\u21C4\u2309\u27E7\u295D\u21C2\u2955\u230B\u22A2\u21A6\u295B\u22B3\u29D0\u22B5\u294F\u295C\u21BE\u2954\u21C0\u2953\u21D2\u211D\u2970\u21DB\u211B\u21B1\u29F4\u0429\u0428\u042C\u015A\u2ABC\u0160\u015E\u015C\u0421\u{1D516}\u2193\u2190\u2192\u2191\u03A3\u2218\u{1D54A}\u221A\u25A1\u2293\u228F\u2291\u2290\u2292\u2294\u{1D4AE}\u22C6\u22D0\u22D0\u2286\u227B\u2AB0\u227D\u227F\u220B\u2211\u22D1\u2283\u2287\u22D1\xDE\u2122\u040B\u0426	\u03A4\u0164\u0162\u0422\u{1D517}\u2234\u0398\u205F\u200A\u2009\u223C\u2243\u2245\u2248\u{1D54B}\u20DB\u{1D4AF}\u0166\xDA\u219F\u2949\u040E\u016C\xDB\u0423\u0170\u{1D518}\xD9\u016A_\u23DF\u23B5\u23DD\u22C3\u228E\u0172\u{1D54C}\u2191\u2912\u21C5\u2195\u296E\u22A5\u21A5\u21D1\u21D5\u2196\u2197\u03D2\u03A5\u016E\u{1D4B0}\u0168\xDC\u22AB\u2AEB\u0412\u22A9\u2AE6\u22C1\u2016\u2016\u2223|\u2758\u2240\u200A\u{1D519}\u{1D54D}\u{1D4B1}\u22AA\u0174\u22C0\u{1D51A}\u{1D54E}\u{1D4B2}\u{1D51B}\u039E\u{1D54F}\u{1D4B3}\u042F\u0407\u042E\xDD\u0176\u042B\u{1D51C}\u{1D550}\u{1D4B4}\u0178\u0416\u0179\u017D\u0417\u017B\u200B\u0396\u2128\u2124\u{1D4B5}\xE1\u0103\u223E\u223E\u0333\u223F\xE2\xB4\u0430\xE6\u2061\u{1D51E}\xE0\u2135\u2135\u03B1\u0101\u2A3F&\u2227\u2A55\u2A5C\u2A58\u2A5A\u2220\u29A4\u2220\u2221\u29A8\u29A9\u29AA\u29AB\u29AC\u29AD\u29AE\u29AF\u221F\u22BE\u299D\u2222\xC5\u237C\u0105\u{1D552}\u2248\u2A70\u2A6F\u224A\u224B\'\u2248\u224A\xE5\u{1D4B6}*\u2248\u224D\xE3\xE4\u2233\u2A11\u2AED\u224C\u03F6\u2035\u223D\u22CD\u22BD\u2305\u2305\u23B5\u23B6\u224C\u0431\u201E\u2235\u2235\u29B0\u03F6\u212C\u03B2\u2136\u226C\u{1D51F}\u22C2\u25EF\u22C3\u2A00\u2A01\u2A02\u2A06\u2605\u25BD\u25B3\u2A04\u22C1\u22C0\u290D\u29EB\u25AA\u25B4\u25BE\u25C2\u25B8\u2423\u2592\u2591\u2593\u2588=\u20E5\u2261\u20E5\u2310\u{1D553}\u22A5\u22A5\u22C8\u2557\u2554\u2556\u2553\u2550\u2566\u2569\u2564\u2567\u255D\u255A\u255C\u2559\u2551\u256C\u2563\u2560\u256B\u2562\u255F\u29C9\u2555\u2552\u2510\u250C\u2500\u2565\u2568\u252C\u2534\u229F\u229E\u22A0\u255B\u2558\u2518\u2514\u2502\u256A\u2561\u255E\u253C\u2524\u251C\u2035\u02D8\xA6\u{1D4B7}\u204F\u223D\u22CD\\\u29C5\u27C8\u2022\u2022\u224E\u2AAE\u224F\u224F\u0107\u2229\u2A44\u2A49\u2A4B\u2A47\u2A40\u2229\uFE00\u2041\u02C7\u2A4D\u010D\xE7\u0109\u2A4C\u2A50\u010B\xB8\u29B2\xA2\xB7\u{1D520}\u0447\u2713\u2713\u03C7\u25CB\u29C3\u02C6\u2257\u21BA\u21BB\xAE\u24C8\u229B\u229A\u229D\u2257\u2A10\u2AEF\u29C2\u2663\u2663:\u2254\u2254,@\u2201\u2218\u2201\u2102\u2245\u2A6D\u222E\u{1D554}\u2210\xA9\u2117\u21B5\u2717\u{1D4B8}\u2ACF\u2AD1\u2AD0\u2AD2\u22EF\u2938\u2935\u22DE\u22DF\u21B6\u293D\u222A\u2A48\u2A46\u2A4A\u228D\u2A45\u222A\uFE00\u21B7\u293C\u22DE\u22DF\u22CE\u22CF\xA4\u21B6\u21B7\u22CE\u22CF\u2232\u2231\u232D\u21D3\u2965\u2020\u2138\u2193\u2010\u22A3\u290F\u02DD\u010F\u0434\u2146\u2021\u21CA\u2A77\xB0\u03B4\u29B1\u297F\u{1D521}\u21C3\u21C2\u22C4\u22C4\u2666\u2666\xA8\u03DD\u22F2\xF7\xF7\u22C7\u22C7\u0452\u231E\u230D$\u{1D555}\u02D9\u2250\u2251\u2238\u2214\u22A1\u2306\u2193\u21CA\u21C3\u21C2\u2910\u231F\u230C\u{1D4B9}\u0455\u29F6\u0111\u22F1\u25BF\u25BE\u21F5\u296F\u29A6\u045F\u27FF\u2A77\u2251\xE9\u2A6E\u011B\u2256\xEA\u2255\u044D\u0117\u2147\u2252\u{1D522}\u2A9A\xE8\u2A96\u2A98\u2A99\u23E7\u2113\u2A95\u2A97\u0113\u2205\u2205\u2205\u2003\u2004\u2005\u014B\u2002\u0119\u{1D556}\u22D5\u29E3\u2A71\u03B5\u03B5\u03F5\u2256\u2255\u2242\u2A96\u2A95=\u225F\u2261\u2A78\u29E5\u2253\u2971\u212F\u2250\u2242\u03B7\xF0\xEB\u20AC!\u2203\u2130\u2147\u2252\u0444\u2640\uFB03\uFB00\uFB04\u{1D523}\uFB01fj\u266D\uFB02\u25B1\u0192\u{1D557}\u2200\u22D4\u2AD9\u2A0D\xBD\u2153\xBC\u2155\u2159\u215B\u2154\u2156\xBE\u2157\u215C\u2158\u215A\u215D\u215E\u2044\u2322\u{1D4BB}\u2267\u2A8C\u01F5\u03B3\u03DD\u2A86\u011F\u011D\u0433\u0121\u2265\u22DB\u2265\u2267\u2A7E\u2A7E\u2AA9\u2A80\u2A82\u2A84\u22DB\uFE00\u2A94\u{1D524}\u226B\u22D9\u2137\u0453\u2277\u2A92\u2AA5\u2AA4\u2269\u2A8A\u2A8A\u2A88\u2A88\u2269\u22E7\u{1D558}`\u210A\u2273\u2A8E\u2A90>\u2AA7\u2A7A\u22D7\u2995\u2A7C\u2A86\u2978\u22D7\u22DB\u2A8C\u2277\u2273\u2269\uFE00\u2269\uFE00\u21D4\u200A\xBD\u210B\u044A\u2194\u2948\u21AD\u210F\u0125\u2665\u2665\u2026\u22B9\u{1D525}\u2925\u2926\u21FF\u223B\u21A9\u21AA\u{1D559}\u2015\u{1D4BD}\u210F\u0127\u2043\u2010\xED\u2063\xEE\u0438\u0435\xA1\u21D4\u{1D526}\xEC\u2148\u2A0C\u222D\u29DC\u2129\u0133\u012B\u2111\u2110\u2111\u0131\u22B7\u01B5\u2208\u2105\u221E\u29DD\u0131\u222B\u22BA\u2124\u22BA\u2A17\u2A3C\u0451\u012F\u{1D55A}\u03B9\u2A3C\xBF\u{1D4BE}\u2208\u22F9\u22F5\u22F4\u22F3\u2208\u2062\u0129\u0456\xEF\u0135\u0439\u{1D527}\u0237\u{1D55B}\u{1D4BF}\u0458\u0454\u03BA\u03F0\u0137\u043A\u{1D528}\u0138\u0445\u045C\u{1D55C}\u{1D4C0}\u21DA\u21D0\u291B\u290E\u2266\u2A8B\u2962\u013A\u29B4\u2112\u03BB\u27E8\u2991\u27E8\u2A85\xAB\u2190\u21E4\u291F\u291D\u21A9\u21AB\u2939\u2973\u21A2\u2AAB\u2919\u2AAD\u2AAD\uFE00\u290C\u2772{[\u298B\u298F\u298D\u013E\u013C\u2308{\u043B\u2936\u201C\u201E\u2967\u294B\u21B2\u2264\u2190\u21A2\u21BD\u21BC\u21C7\u2194\u21C6\u21CB\u21AD\u22CB\u22DA\u2264\u2266\u2A7D\u2A7D\u2AA8\u2A7F\u2A81\u2A83\u22DA\uFE00\u2A93\u2A85\u22D6\u22DA\u2A8B\u2276\u2272\u297C\u230A\u{1D529}\u2276\u2A91\u21BD\u21BC\u296A\u2584\u0459\u226A\u21C7\u231E\u296B\u25FA\u0140\u23B0\u23B0\u2268\u2A89\u2A89\u2A87\u2A87\u2268\u22E6\u27EC\u21FD\u27E6\u27F5\u27F7\u27FC\u27F6\u21AB\u21AC\u2985\u{1D55D}\u2A2D\u2A34\u2217_\u25CA\u25CA\u29EB(\u2993\u21C6\u231F\u21CB\u296D\u200E\u22BF\u2039\u{1D4C1}\u21B0\u2272\u2A8D\u2A8F[\u2018\u201A\u0142<\u2AA6\u2A79\u22D6\u22CB\u22C9\u2976\u2A7B\u2996\u25C3\u22B4\u25C2\u294A\u2966\u2268\uFE00\u2268\uFE00\u223A\xAF\u2642\u2720\u2720\u21A6\u21A6\u21A7\u21A4\u21A5\u25AE\u2A29\u043C\u2014\u2221\u{1D52A}\u2127\xB5\u2223*\u2AF0\xB7\u2212\u229F\u2238\u2A2A\u2ADB\u2026\u2213\u22A7\u{1D55E}\u2213\u{1D4C2}\u223E\u03BC\u22B8\u22B8\u22D9\u0338\u226B\u20D2\u226B\u0338\u21CD\u21CE\u22D8\u0338\u226A\u20D2\u226A\u0338\u21CF\u22AF\u22AE\u2207\u0144\u2220\u20D2\u2249\u2A70\u0338\u224B\u0338\u0149\u2249\u266E\u266E\u2115\xA0\u224E\u0338\u224F\u0338\u2A43\u0148\u0146\u2247\u2A6D\u0338\u2A42\u043D\u2013\u2260\u21D7\u2924\u2197\u2197\u2250\u0338\u2262\u2928\u2242\u0338\u2204\u2204\u{1D52B}\u2267\u0338\u2271\u2271\u2267\u0338\u2A7E\u0338\u2A7E\u0338\u2275\u226F\u226F\u21CE\u21AE\u2AF2\u220B\u22FC\u22FA\u220B\u045A\u21CD\u2266\u0338\u219A\u2025\u2270\u219A\u21AE\u2270\u2266\u0338\u2A7D\u0338\u2A7D\u0338\u226E\u2274\u226E\u22EA\u22EC\u2224\u{1D55F}\xAC\u2209\u22F9\u0338\u22F5\u0338\u2209\u22F7\u22F6\u220C\u220C\u22FE\u22FD\u2226\u2226\u2AFD\u20E5\u2202\u0338\u2A14\u2280\u22E0\u2AAF\u0338\u2280\u2AAF\u0338\u21CF\u219B\u2933\u0338\u219D\u0338\u219B\u22EB\u22ED\u2281\u22E1\u2AB0\u0338\u{1D4C3}\u2224\u2226\u2241\u2244\u2244\u2224\u2226\u22E2\u22E3\u2284\u2AC5\u0338\u2288\u2282\u20D2\u2288\u2AC5\u0338\u2281\u2AB0\u0338\u2285\u2AC6\u0338\u2289\u2283\u20D2\u2289\u2AC6\u0338\u2279\xF1\u2278\u22EA\u22EC\u22EB\u22ED\u03BD#\u2116\u2007\u22AD\u2904\u224D\u20D2\u22AC\u2265\u20D2>\u20D2\u29DE\u2902\u2264\u20D2<\u20D2\u22B4\u20D2\u2903\u22B5\u20D2\u223C\u20D2\u21D6\u2923\u2196\u2196\u2927\u24C8\xF3\u229B\u229A\xF4\u043E\u229D\u0151\u2A38\u2299\u29BC\u0153\u29BF\u{1D52C}\u02DB\xF2\u29C1\u29B5\u03A9\u222E\u21BA\u29BE\u29BB\u203E\u29C0\u014D\u03C9\u03BF\u29B6\u2296\u{1D560}\u29B7\u29B9\u2295\u2228\u21BB\u2A5D\u2134\u2134\xAA\xBA\u22B6\u2A56\u2A57\u2A5B\u2134\xF8\u2298\xF5\u2297\u2A36\xF6\u233D\u2225\xB6\u2225\u2AF3\u2AFD\u2202\u043F%.\u2030\u22A5\u2031\u{1D52D}\u03C6\u03D5\u2133\u260E\u03C0\u22D4\u03D6\u210F\u210E\u210F+\u2A23\u229E\u2A22\u2214\u2A25\u2A72\xB1\u2A26\u2A27\xB1\u2A15\u{1D561}\xA3\u227A\u2AB3\u2AB7\u227C\u2AAF\u227A\u2AB7\u227C\u2AAF\u2AB9\u2AB5\u22E8\u227E\u2032\u2119\u2AB5\u2AB9\u22E8\u220F\u232E\u2312\u2313\u221D\u221D\u227E\u22B0\u{1D4C5}\u03C8\u2008\u{1D52E}\u2A0C\u{1D562}\u2057\u{1D4C6}\u210D\u2A16?\u225F"\u21DB\u21D2\u291C\u290F\u2964\u223D\u0331\u0155\u221A\u29B3\u27E9\u2992\u29A5\u27E9\xBB\u2192\u2975\u21E5\u2920\u2933\u291E\u21AA\u21AC\u2945\u2974\u21A3\u219D\u291A\u2236\u211A\u290D\u2773}]\u298C\u298E\u2990\u0159\u0157\u2309}\u0440\u2937\u2969\u201D\u201D\u21B3\u211C\u211B\u211C\u211D\u25AD\xAE\u297D\u230B\u{1D52F}\u21C1\u21C0\u296C\u03C1\u03F1\u2192\u21A3\u21C1\u21C0\u21C4\u21CC\u21C9\u219D\u22CC\u02DA\u2253\u21C4\u21CC\u200F\u23B1\u23B1\u2AEE\u27ED\u21FE\u27E7\u2986\u{1D563}\u2A2E\u2A35)\u2994\u2A12\u21C9\u203A\u{1D4C7}\u21B1]\u2019\u2019\u22CC\u22CA\u25B9\u22B5\u25B8\u29CE\u2968\u211E\u015B\u201A\u227B\u2AB4\u2AB8\u0161\u227D\u2AB0\u015F\u015D\u2AB6\u2ABA\u22E9\u2A13\u227F\u0441\u22C5\u22A1\u2A66\u21D8\u2925\u2198\u2198\xA7;\u2929\u2216\u2216\u2736\u{1D530}\u2322\u266F\u0449\u0448\u2223\u2225\xAD\u03C3\u03C2\u03C2\u223C\u2A6A\u2243\u2243\u2A9E\u2AA0\u2A9D\u2A9F\u2246\u2A24\u2972\u2190\u2216\u2A33\u29E4\u2223\u2323\u2AAA\u2AAC\u2AAC\uFE00\u044C/\u29C4\u233F\u{1D564}\u2660\u2660\u2225\u2293\u2293\uFE00\u2294\u2294\uFE00\u228F\u2291\u228F\u2291\u2290\u2292\u2290\u2292\u25A1\u25A1\u25AA\u25AA\u2192\u{1D4C8}\u2216\u2323\u22C6\u2606\u2605\u03F5\u03D5\xAF\u2282\u2AC5\u2ABD\u2286\u2AC3\u2AC1\u2ACB\u228A\u2ABF\u2979\u2282\u2286\u2AC5\u228A\u2ACB\u2AC7\u2AD5\u2AD3\u227B\u2AB8\u227D\u2AB0\u2ABA\u2AB6\u22E9\u227F\u2211\u266A\u2283\xB9\xB2\xB3\u2AC6\u2ABE\u2AD8\u2287\u2AC4\u27C9\u2AD7\u297B\u2AC2\u2ACC\u228B\u2AC0\u2283\u2287\u2AC6\u228B\u2ACC\u2AC8\u2AD4\u2AD6\u21D9\u2926\u2199\u2199\u292A\xDF\u2316\u03C4\u23B4\u0165\u0163\u0442\u20DB\u2315\u{1D531}\u2234\u2234\u03B8\u03D1\u03D1\u2248\u223C\u2009\u2248\u223C\xFE\u02DC\xD7\u22A0\u2A31\u2A30\u222D\u2928\u22A4\u2336\u2AF1\u{1D565}\u2ADA\u2929\u2034\u2122\u25B5\u25BF\u25C3\u22B4\u225C\u25B9\u22B5\u25EC\u225C\u2A3A\u2A39\u29CD\u2A3B\u23E2\u{1D4C9}\u0446\u045B\u0167\u226C\u219E\u21A0\u21D1\u2963\xFA\u2191\u045E\u016D\xFB\u0443\u21C5\u0171\u296E\u297E\u{1D532}\xF9\u21BF\u21BE\u2580\u231C\u231C\u230F\u25F8\u016B\xA8\u0173\u{1D566}\u2191\u2195\u21BF\u21BE\u228E\u03C5\u03D2\u03C5\u21C8\u231D\u231D\u230E\u016F\u25F9\u{1D4CA}\u22F0\u0169\u25B5\u25B4\u21C8\xFC\u29A7\u21D5\u2AE8\u2AE9\u22A8\u299C\u03F5\u03F0\u2205\u03D5\u03D6\u221D\u2195\u03F1\u03C2\u228A\uFE00\u2ACB\uFE00\u228B\uFE00\u2ACC\uFE00\u03D1\u22B2\u22B3\u0432\u22A2\u2228\u22BB\u225A\u22EE||\u{1D533}\u22B2\u2282\u20D2\u2283\u20D2\u{1D567}\u221D\u22B3\u{1D4CB}\u2ACB\uFE00\u228A\uFE00\u2ACC\uFE00\u228B\uFE00\u299A\u0175\u2A5F\u2227\u2259\u2118\u{1D534}\u{1D568}\u2118\u2240\u2240\u{1D4CC}\u22C2\u25EF\u22C3\u25BD\u{1D535}\u27FA\u27F7\u03BE\u27F8\u27F5\u27FC\u22FB\u2A00\u{1D569}\u2A01\u2A02\u27F9\u27F6\u{1D4CD}\u2A06\u2A04\u25B3\u22C1\u22C0\xFD\u044F\u0177\u044B\xA5\u{1D536}\u0457\u{1D56A}\u{1D4CE}\u044E\xFF\u017A\u017E\u0437\u017C\u2128\u03B6\u{1D537}\u0436\u21DD\u{1D56B}\u{1D4CF}\u200D\u200C'];

// node_modules/entities/dist/internal/decode-data-format.js
var META_BIAS = 35;
var HEADER_BIAS = 48;
var HEADER_LENGTH = 6;
var CHOICE_BITS_PER_CHAR = 6;
var BUCKET_HASH_1 = 2654435761;
var BUCKET_HASH_2 = 2246822507;
var PAIR_TABLE_SIZE = 1024;
var CHAR_REMAP = (() => {
  const remap = new Uint8Array(128);
  for (let code = 48; code <= 57; code++)
    remap[code] = code - 47;
  for (let code = 65; code <= 90; code++)
    remap[code] = code - 54;
  for (let code = 97; code <= 122; code++)
    remap[code] = code - 60;
  return remap;
})();
function exactKey(text, nameStart, length) {
  return text.charCodeAt(nameStart) << 25 | text.charCodeAt(nameStart + 1) << 18 | text.charCodeAt(nameStart + length - 2) << 11 | CHAR_REMAP[text.charCodeAt(nameStart + length - 1)] << 5 | length;
}
function pairIndex(c0, c12) {
  return (c0 * 3 << 3 ^ c12) & PAIR_TABLE_SIZE - 1;
}
function bucketOne(key, buckets) {
  return (Math.imul(key, BUCKET_HASH_1) >>> 16) * buckets >>> 16;
}
function bucketTwo(key, buckets) {
  return (Math.imul(key, BUCKET_HASH_2) >>> 16) * buckets >>> 16;
}
function initDecodeData(packed) {
  const [data2, values] = packed;
  const nameCount = data2.charCodeAt(0) - HEADER_BIAS << 6 | data2.charCodeAt(1) - HEADER_BIAS;
  const suffixesLength = data2.charCodeAt(2) - HEADER_BIAS << 6 | data2.charCodeAt(3) - HEADER_BIAS;
  const buckets = data2.charCodeAt(4) - HEADER_BIAS << 6 | data2.charCodeAt(5) - HEADER_BIAS;
  const metaStart = HEADER_LENGTH + suffixesLength;
  const choicesStart = metaStart + 2 * nameCount;
  const slotCount = 2 * buckets;
  const keys = new Int32Array(slotCount);
  const slotMidOff = new Uint16Array(slotCount);
  const slotValue = new Uint16Array(slotCount);
  const lengthBits = new Uint32Array(PAIR_TABLE_SIZE);
  const middleOffsets = /* @__PURE__ */ new Map();
  const middles = [];
  let name = "";
  let suffixOffset = HEADER_LENGTH;
  let valueOffset = 0;
  for (let index = 0; index < nameCount; index++) {
    const meta0 = data2.charCodeAt(metaStart + 2 * index) - META_BIAS;
    const meta1 = data2.charCodeAt(metaStart + 2 * index + 1) - META_BIAS;
    const prefixLength = meta0 & 31;
    const length = prefixLength + (meta1 & 31);
    const valueLength = (meta1 >> 5) + 1;
    name = name.slice(0, prefixLength) + data2.slice(suffixOffset, suffixOffset + length - prefixLength);
    suffixOffset += length - prefixLength;
    const key = exactKey(name, 0, length);
    const choice = data2.charCodeAt(choicesStart + Math.floor(index / CHOICE_BITS_PER_CHAR)) - HEADER_BIAS & 1 << index % CHOICE_BITS_PER_CHAR;
    let slot = 2 * (choice === 0 ? bucketOne : bucketTwo)(key, buckets);
    if (keys[slot] !== 0)
      slot += 1;
    keys[slot] = key;
    if (length > 4) {
      const middle = name.slice(2, length - 2);
      const existing = middleOffsets.get(middle);
      if (existing === void 0) {
        middleOffsets.set(middle, middles.length);
        slotMidOff[slot] = middles.length;
        for (let middleIndex = 0; middleIndex < middle.length; middleIndex += 2) {
          middles.push(middle.charCodeAt(middleIndex) | middle.charCodeAt(middleIndex + 1) << 16);
        }
      } else {
        slotMidOff[slot] = existing;
      }
    }
    const pair = pairIndex(name.charCodeAt(0), name.charCodeAt(1));
    lengthBits[pair] |= length <= 16 ? 1 << length - 2 : 32768;
    if ((meta0 & 32) !== 0) {
      lengthBits[pair] |= 1 << length - 2 + 16;
    }
    slotValue[slot] = valueOffset << 2 | valueLength - 1 | (meta0 & 32) >> 4;
    valueOffset += valueLength;
  }
  return {
    keys,
    buckets,
    slotMidOff,
    slotValue,
    values,
    lengthBits,
    middles: new Uint32Array(middles)
  };
}

// node_modules/entities/dist/decode.js
var CHAR_NUM = 35;
var CHAR_SEMI = 59;
var CHAR_EQUALS = 61;
var CHAR_ZERO = 48;
var CHAR_LOWER_A = 97;
var CHAR_LOWER_X = 120;
var CHAR_UPPER_A = 65;
var TO_LOWER_BIT = 32;
function isNumber(code) {
  return code - CHAR_ZERO >>> 0 <= 9;
}
function isAlphaNumeric(code) {
  return isNumber(code) || (code | TO_LOWER_BIT) - CHAR_LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CHAR_EQUALS || isAlphaNumeric(code);
}
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
var htmlDecode = /* @__PURE__ */ initDecodeData(htmlDecodeData);
var htmlKeys = /* @__PURE__ */ (() => htmlDecode.keys)();
var htmlBuckets = /* @__PURE__ */ (() => htmlDecode.buckets)();
var htmlSlotMidOff = /* @__PURE__ */ (() => htmlDecode.slotMidOff)();
var htmlLengthBits = /* @__PURE__ */ (() => htmlDecode.lengthBits)();
var htmlMiddles = /* @__PURE__ */ (() => htmlDecode.middles)();
var htmlSlotValue = /* @__PURE__ */ (() => htmlDecode.slotValue)();
var htmlValues = /* @__PURE__ */ (() => htmlDecode.values)();
function findSlotHtml(text, start, length) {
  const c0 = text.charCodeAt(start);
  const c12 = text.charCodeAt(start + 1);
  const c2 = text.charCodeAt(start + length - 2);
  const c3 = text.charCodeAt(start + length - 1);
  if ((c0 | c12 | c2 | c3) > 127)
    return -1;
  const key = c0 << 25 | c12 << 18 | c2 << 11 | CHAR_REMAP[c3] << 5 | length;
  let slot = 2 * ((Math.imul(key, BUCKET_HASH_1) >>> 16) * htmlBuckets >>> 16);
  for (let attempt = 0; ; attempt++) {
    if (htmlKeys[slot] === key && (length <= 4 || isMidMatchHtml(slot, text, start, length))) {
      return slot;
    }
    if (htmlKeys[slot + 1] === key && (length <= 4 || isMidMatchHtml(slot + 1, text, start, length))) {
      return slot + 1;
    }
    if (attempt === 1)
      return -1;
    slot = 2 * ((Math.imul(key, BUCKET_HASH_2) >>> 16) * htmlBuckets >>> 16);
  }
}
function isMidMatchHtml(slot, text, start, length) {
  let wordIndex = htmlSlotMidOff[slot];
  let index = start + 2;
  const end = start + length - 2;
  while (index + 1 < end) {
    if ((text.charCodeAt(index) | text.charCodeAt(index + 1) << 16) !== htmlMiddles[wordIndex++])
      return false;
    index += 2;
  }
  return index === end || text.charCodeAt(index) === (htmlMiddles[wordIndex] & 65535);
}
var numericDigits = /* @__PURE__ */ (() => {
  const digits = new Uint8Array(128).fill(255);
  for (let digit = 0; digit < 10; digit++) {
    digits[CHAR_ZERO + digit] = digit;
  }
  for (let digit = 0; digit < 6; digit++) {
    digits[CHAR_UPPER_A + digit] = digit + 10;
    digits[CHAR_LOWER_A + digit] = digit + 10;
  }
  return digits;
})();
function findLegacySlot(input, start, maxLength) {
  let legacy = htmlLengthBits[pairIndex(input.charCodeAt(start), input.charCodeAt(start + 1))] >>> 16 & 31;
  while (legacy !== 0) {
    const top = 31 - Math.clz32(legacy);
    legacy ^= 1 << top;
    if (top + 2 > maxLength)
      continue;
    const slot = findSlotHtml(input, start, top + 2);
    if (slot >= 0 && (htmlSlotValue[slot] & 2) !== 0) {
      return slot << 3 | top + 2;
    }
  }
  return -1;
}
function findLongClassMatch(input, start, mode) {
  const length = input.slice(start, start + 32).indexOf(";");
  if (length - 2 >>> 0 <= 29) {
    const slot = findSlotHtml(input, start, length);
    if (slot >= 0)
      return slot << 6 | length + 1;
  }
  if (mode !== DecodingMode.Strict) {
    const packed = findLegacySlot(input, start, Math.min(31, input.length - start));
    if (packed >= 0) {
      const length2 = packed & 7;
      if (mode !== DecodingMode.Attribute || start + length2 >= input.length || !isEntityInAttributeInvalidEnd(input.charCodeAt(start + length2)))
        return packed >> 3 << 6 | length2;
    }
  }
  return -1;
}
var STATE_ENTITY_START = 0;
var STATE_NUMERIC_START = 1;
var STATE_NUMERIC_DECIMAL = 2;
var STATE_NUMERIC_HEX = 3;
var STATE_NAMED_ENTITY = 4;
var EntityDecoderBase = class {
  emitCodePoint;
  errors;
  /** The current state of the decoder. */
  state = STATE_ENTITY_START;
  /** Characters that were consumed while parsing an entity. */
  consumed = 1;
  /** Accumulated numeric code point, or a packed partial XML name. */
  result = 0;
  /** The mode in which the decoder is operating. */
  decodeMode = DecodingMode.Strict;
  /** Replacement rules for numeric character references. */
  replaceNumericCodePoint = replaceCodePoint;
  constructor(emitCodePoint, errors) {
    this.emitCodePoint = emitCodePoint;
    this.errors = errors;
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericStart(input, offset2) {
    if (offset2 >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset2) | TO_LOWER_BIT) === CHAR_LOWER_X) {
      this.state = STATE_NUMERIC_HEX;
      this.consumed += 1;
      return this.stateNumericHex(input, offset2 + 1);
    }
    this.state = STATE_NUMERIC_DECIMAL;
    return this.stateNumericDecimal(input, offset2);
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexadecimal character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset2) {
    const inputLength = input.length;
    let { result, consumed } = this;
    let index = offset2;
    while (index < inputLength) {
      const char = input.charCodeAt(index);
      const digit = numericDigits[char];
      if (digit <= 15) {
        result = result * 16 + digit;
      } else {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(char, 3);
      }
      consumed += 1;
      index += 1;
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset2) {
    const inputLength = input.length;
    let { result, consumed } = this;
    let index = offset2;
    while (index < inputLength) {
      const digit = input.charCodeAt(index) - CHAR_ZERO;
      if (digit >>> 0 > 9) {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(digit + CHAR_ZERO, 2);
      }
      result = result * 10 + digit;
      consumed += 1;
      index += 1;
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexadecimal character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    if (this.consumed <= expectedLength) {
      this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CHAR_SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint(this.replaceNumericCodePoint(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CHAR_SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  /**
   * Resets the instance to make it reusable.
   * @param decodeMode Entity decoding mode to use.
   */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = STATE_ENTITY_START;
    this.result = 0;
    this.consumed = 1;
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset2) {
    switch (this.state) {
      case STATE_ENTITY_START: {
        if (input.charCodeAt(offset2) === CHAR_NUM) {
          this.state = STATE_NUMERIC_START;
          this.consumed += 1;
          return this.stateNumericStart(input, offset2 + 1);
        }
        this.state = STATE_NAMED_ENTITY;
        return this.stateNamedEntity(input, offset2);
      }
      case STATE_NUMERIC_START: {
        return this.stateNumericStart(input, offset2);
      }
      case STATE_NUMERIC_DECIMAL: {
        return this.stateNumericDecimal(input, offset2);
      }
      case STATE_NUMERIC_HEX: {
        return this.stateNumericHex(input, offset2);
      }
      default: {
        return this.stateNamedEntity(input, offset2);
      }
    }
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   * @returns The number of characters consumed.
   */
  end() {
    switch (this.state) {
      case STATE_NAMED_ENTITY: {
        return this.endNamedEntity();
      }
      // Otherwise, emit a numeric entity if we have one.
      case STATE_NUMERIC_DECIMAL: {
        return this.emitNumericEntity(0, 2);
      }
      case STATE_NUMERIC_HEX: {
        return this.emitNumericEntity(0, 3);
      }
      case STATE_NUMERIC_START: {
        this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      default: {
        return 0;
      }
    }
  }
};
var HtmlEntityDecoder = class extends EntityDecoderBase {
  /** Total name characters seen for the current named entity. */
  runLength = 0;
  /** Reused for ASCII alphanumerics; the 32nd character rules out an exact match. */
  nameBuffer = new Uint8Array(32);
  /**
   * Emit the replacement for a matched slot. Values are at most two
   * UTF-16 code units; like previous versions, each unit is emitted as
   * its own callback (surrogate halves included).
   * @param slot The matched slot.
   */
  emitSlot(slot) {
    const packed = htmlSlotValue[slot];
    const off = packed >> 2;
    this.emitCodePoint(htmlValues.charCodeAt(off), this.consumed);
    if ((packed & 1) !== 0) {
      this.emitCodePoint(htmlValues.charCodeAt(off + 1), this.consumed);
    }
  }
  startEntity(decodeMode) {
    super.startEntity(decodeMode);
    this.runLength = 0;
  }
  stateNamedEntity(input, offset2) {
    const inputLength = input.length;
    if (this.runLength === 0 && offset2 + 17 <= inputLength) {
      const c0 = input.charCodeAt(offset2);
      const pair = pairIndex(c0, input.charCodeAt(offset2 + 1));
      const bits = htmlLengthBits[pair];
      if ((bits & 32768) !== 0 && offset2 + 32 <= inputLength) {
        const packed = findLongClassMatch(input, offset2, this.decodeMode);
        if (packed >= 0) {
          const length = packed & 63;
          this.consumed = length + 1;
          this.emitSlot(packed >> 6);
          if (input.charCodeAt(offset2 + length - 1) !== CHAR_SEMI) {
            this.errors?.missingSemicolonAfterCharacterReference();
          }
          return this.consumed;
        }
        return 0;
      }
      let probed = bits & 32767;
      while (probed !== 0) {
        const low = probed & -probed;
        probed ^= low;
        const length = 33 - Math.clz32(low);
        if (input.charCodeAt(offset2 + length) === CHAR_SEMI) {
          const slot = findSlotHtml(input, offset2, length);
          if (slot >= 0) {
            this.consumed = length + 2;
            this.emitSlot(slot);
            return this.consumed;
          }
        }
      }
      if ((bits & 32768) === 0) {
        if (this.decodeMode !== DecodingMode.Strict) {
          const packed = findLegacySlot(input, offset2, 31);
          if (packed >= 0) {
            const matchLength = packed & 7;
            const next = input.charCodeAt(offset2 + matchLength);
            if (this.decodeMode === DecodingMode.Attribute && isEntityInAttributeInvalidEnd(next)) {
              return 0;
            }
            this.consumed = matchLength + 1;
            this.emitSlot(packed >> 3);
            this.errors?.missingSemicolonAfterCharacterReference();
            return this.consumed;
          }
        }
        return 0;
      }
    }
    let index = offset2;
    let { runLength } = this;
    let terminator = -1;
    const scanEnd = Math.min(inputLength, offset2 + 32 - runLength);
    while (index < scanEnd) {
      const char = input.charCodeAt(index);
      if (!isAlphaNumeric(char)) {
        terminator = char;
        break;
      }
      this.nameBuffer[runLength++] = char;
      index++;
    }
    if (terminator < 0 && runLength < 32) {
      this.runLength = runLength;
      return -1;
    }
    if (terminator === CHAR_SEMI && runLength - 2 >>> 0 <= 29) {
      const slot = findBufferedHtmlSlot(this.nameBuffer, runLength);
      if (slot >= 0) {
        this.consumed = runLength + 2;
        this.emitSlot(slot);
        return this.consumed;
      }
    }
    if (this.decodeMode !== DecodingMode.Strict && runLength >= 2) {
      const packed = findBufferedLegacySlot(this.nameBuffer, runLength);
      if (packed >= 0) {
        const length = packed & 7;
        const next = length < runLength ? this.nameBuffer[length] : terminator;
        if (this.decodeMode === DecodingMode.Attribute && isEntityInAttributeInvalidEnd(next))
          return 0;
        this.consumed = length + 1;
        this.emitSlot(packed >> 3);
        this.errors?.missingSemicolonAfterCharacterReference();
        return this.consumed;
      }
    }
    return 0;
  }
  endNamedEntity() {
    if (this.decodeMode === DecodingMode.Strict || this.runLength < 2) {
      return 0;
    }
    const packed = findBufferedLegacySlot(this.nameBuffer, this.runLength);
    if (packed < 0)
      return 0;
    if (this.decodeMode === DecodingMode.Attribute && (packed & 7) < this.runLength) {
      return 0;
    }
    this.consumed = (packed & 7) + 1;
    this.emitSlot(packed >> 3);
    this.errors?.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
};
function findBufferedHtmlSlot(buffer, length) {
  const key = buffer[0] << 25 | buffer[1] << 18 | buffer[length - 2] << 11 | CHAR_REMAP[buffer[length - 1]] << 5 | length;
  let slot = 2 * ((Math.imul(key, BUCKET_HASH_1) >>> 16) * htmlBuckets >>> 16);
  for (let attempt = 0; ; attempt++) {
    if (htmlKeys[slot] === key && (length <= 4 || isBufferedMiddle(slot, buffer, length)))
      return slot;
    if (htmlKeys[slot + 1] === key && (length <= 4 || isBufferedMiddle(slot + 1, buffer, length)))
      return slot + 1;
    if (attempt === 1)
      return -1;
    slot = 2 * ((Math.imul(key, BUCKET_HASH_2) >>> 16) * htmlBuckets >>> 16);
  }
}
function isBufferedMiddle(slot, buffer, length) {
  let wordIndex = htmlSlotMidOff[slot];
  let index = 2;
  const end = length - 2;
  while (index + 1 < end) {
    if ((buffer[index] | buffer[index + 1] << 16) !== htmlMiddles[wordIndex++])
      return false;
    index += 2;
  }
  return index === end || buffer[index] === (htmlMiddles[wordIndex] & 65535);
}
function findBufferedLegacySlot(buffer, length) {
  let legacy = htmlLengthBits[pairIndex(buffer[0], buffer[1])] >>> 16 & 31;
  while (legacy !== 0) {
    const top = 31 - Math.clz32(legacy);
    legacy ^= 1 << top;
    if (top + 2 > length)
      continue;
    const slot = findBufferedHtmlSlot(buffer, top + 2);
    if (slot >= 0 && (htmlSlotValue[slot] & 2) !== 0)
      return slot << 3 | top + 2;
  }
  return -1;
}

// node_modules/parse5/dist/common/html.js
var NS;
(function(NS2) {
  NS2["HTML"] = "http://www.w3.org/1999/xhtml";
  NS2["MATHML"] = "http://www.w3.org/1998/Math/MathML";
  NS2["SVG"] = "http://www.w3.org/2000/svg";
  NS2["XLINK"] = "http://www.w3.org/1999/xlink";
  NS2["XML"] = "http://www.w3.org/XML/1998/namespace";
  NS2["XMLNS"] = "http://www.w3.org/2000/xmlns/";
})(NS || (NS = {}));
var ATTRS;
(function(ATTRS2) {
  ATTRS2["TYPE"] = "type";
  ATTRS2["ACTION"] = "action";
  ATTRS2["ENCODING"] = "encoding";
  ATTRS2["PROMPT"] = "prompt";
  ATTRS2["NAME"] = "name";
  ATTRS2["COLOR"] = "color";
  ATTRS2["FACE"] = "face";
  ATTRS2["SIZE"] = "size";
})(ATTRS || (ATTRS = {}));
var DOCUMENT_MODE;
(function(DOCUMENT_MODE2) {
  DOCUMENT_MODE2["NO_QUIRKS"] = "no-quirks";
  DOCUMENT_MODE2["QUIRKS"] = "quirks";
  DOCUMENT_MODE2["LIMITED_QUIRKS"] = "limited-quirks";
})(DOCUMENT_MODE || (DOCUMENT_MODE = {}));
var TAG_NAMES;
(function(TAG_NAMES2) {
  TAG_NAMES2["A"] = "a";
  TAG_NAMES2["ADDRESS"] = "address";
  TAG_NAMES2["ANNOTATION_XML"] = "annotation-xml";
  TAG_NAMES2["APPLET"] = "applet";
  TAG_NAMES2["AREA"] = "area";
  TAG_NAMES2["ARTICLE"] = "article";
  TAG_NAMES2["ASIDE"] = "aside";
  TAG_NAMES2["B"] = "b";
  TAG_NAMES2["BASE"] = "base";
  TAG_NAMES2["BASEFONT"] = "basefont";
  TAG_NAMES2["BGSOUND"] = "bgsound";
  TAG_NAMES2["BIG"] = "big";
  TAG_NAMES2["BLOCKQUOTE"] = "blockquote";
  TAG_NAMES2["BODY"] = "body";
  TAG_NAMES2["BR"] = "br";
  TAG_NAMES2["BUTTON"] = "button";
  TAG_NAMES2["CAPTION"] = "caption";
  TAG_NAMES2["CENTER"] = "center";
  TAG_NAMES2["CODE"] = "code";
  TAG_NAMES2["COL"] = "col";
  TAG_NAMES2["COLGROUP"] = "colgroup";
  TAG_NAMES2["DD"] = "dd";
  TAG_NAMES2["DESC"] = "desc";
  TAG_NAMES2["DETAILS"] = "details";
  TAG_NAMES2["DIALOG"] = "dialog";
  TAG_NAMES2["DIR"] = "dir";
  TAG_NAMES2["DIV"] = "div";
  TAG_NAMES2["DL"] = "dl";
  TAG_NAMES2["DT"] = "dt";
  TAG_NAMES2["EM"] = "em";
  TAG_NAMES2["EMBED"] = "embed";
  TAG_NAMES2["FIELDSET"] = "fieldset";
  TAG_NAMES2["FIGCAPTION"] = "figcaption";
  TAG_NAMES2["FIGURE"] = "figure";
  TAG_NAMES2["FONT"] = "font";
  TAG_NAMES2["FOOTER"] = "footer";
  TAG_NAMES2["FOREIGN_OBJECT"] = "foreignObject";
  TAG_NAMES2["FORM"] = "form";
  TAG_NAMES2["FRAME"] = "frame";
  TAG_NAMES2["FRAMESET"] = "frameset";
  TAG_NAMES2["H1"] = "h1";
  TAG_NAMES2["H2"] = "h2";
  TAG_NAMES2["H3"] = "h3";
  TAG_NAMES2["H4"] = "h4";
  TAG_NAMES2["H5"] = "h5";
  TAG_NAMES2["H6"] = "h6";
  TAG_NAMES2["HEAD"] = "head";
  TAG_NAMES2["HEADER"] = "header";
  TAG_NAMES2["HGROUP"] = "hgroup";
  TAG_NAMES2["HR"] = "hr";
  TAG_NAMES2["HTML"] = "html";
  TAG_NAMES2["I"] = "i";
  TAG_NAMES2["IMG"] = "img";
  TAG_NAMES2["IMAGE"] = "image";
  TAG_NAMES2["INPUT"] = "input";
  TAG_NAMES2["IFRAME"] = "iframe";
  TAG_NAMES2["KEYGEN"] = "keygen";
  TAG_NAMES2["LABEL"] = "label";
  TAG_NAMES2["LI"] = "li";
  TAG_NAMES2["LINK"] = "link";
  TAG_NAMES2["LISTING"] = "listing";
  TAG_NAMES2["MAIN"] = "main";
  TAG_NAMES2["MALIGNMARK"] = "malignmark";
  TAG_NAMES2["MARQUEE"] = "marquee";
  TAG_NAMES2["MATH"] = "math";
  TAG_NAMES2["MENU"] = "menu";
  TAG_NAMES2["META"] = "meta";
  TAG_NAMES2["MGLYPH"] = "mglyph";
  TAG_NAMES2["MI"] = "mi";
  TAG_NAMES2["MO"] = "mo";
  TAG_NAMES2["MN"] = "mn";
  TAG_NAMES2["MS"] = "ms";
  TAG_NAMES2["MTEXT"] = "mtext";
  TAG_NAMES2["NAV"] = "nav";
  TAG_NAMES2["NOBR"] = "nobr";
  TAG_NAMES2["NOFRAMES"] = "noframes";
  TAG_NAMES2["NOEMBED"] = "noembed";
  TAG_NAMES2["NOSCRIPT"] = "noscript";
  TAG_NAMES2["OBJECT"] = "object";
  TAG_NAMES2["OL"] = "ol";
  TAG_NAMES2["OPTGROUP"] = "optgroup";
  TAG_NAMES2["OPTION"] = "option";
  TAG_NAMES2["P"] = "p";
  TAG_NAMES2["PARAM"] = "param";
  TAG_NAMES2["PLAINTEXT"] = "plaintext";
  TAG_NAMES2["PRE"] = "pre";
  TAG_NAMES2["RB"] = "rb";
  TAG_NAMES2["RP"] = "rp";
  TAG_NAMES2["RT"] = "rt";
  TAG_NAMES2["RTC"] = "rtc";
  TAG_NAMES2["RUBY"] = "ruby";
  TAG_NAMES2["S"] = "s";
  TAG_NAMES2["SCRIPT"] = "script";
  TAG_NAMES2["SEARCH"] = "search";
  TAG_NAMES2["SECTION"] = "section";
  TAG_NAMES2["SELECT"] = "select";
  TAG_NAMES2["SOURCE"] = "source";
  TAG_NAMES2["SMALL"] = "small";
  TAG_NAMES2["SPAN"] = "span";
  TAG_NAMES2["STRIKE"] = "strike";
  TAG_NAMES2["STRONG"] = "strong";
  TAG_NAMES2["STYLE"] = "style";
  TAG_NAMES2["SUB"] = "sub";
  TAG_NAMES2["SUMMARY"] = "summary";
  TAG_NAMES2["SUP"] = "sup";
  TAG_NAMES2["TABLE"] = "table";
  TAG_NAMES2["TBODY"] = "tbody";
  TAG_NAMES2["TEMPLATE"] = "template";
  TAG_NAMES2["TEXTAREA"] = "textarea";
  TAG_NAMES2["TFOOT"] = "tfoot";
  TAG_NAMES2["TD"] = "td";
  TAG_NAMES2["TH"] = "th";
  TAG_NAMES2["THEAD"] = "thead";
  TAG_NAMES2["TITLE"] = "title";
  TAG_NAMES2["TR"] = "tr";
  TAG_NAMES2["TRACK"] = "track";
  TAG_NAMES2["TT"] = "tt";
  TAG_NAMES2["U"] = "u";
  TAG_NAMES2["UL"] = "ul";
  TAG_NAMES2["SVG"] = "svg";
  TAG_NAMES2["VAR"] = "var";
  TAG_NAMES2["WBR"] = "wbr";
  TAG_NAMES2["XMP"] = "xmp";
})(TAG_NAMES || (TAG_NAMES = {}));
var TAG_ID;
(function(TAG_ID2) {
  TAG_ID2[TAG_ID2["UNKNOWN"] = 0] = "UNKNOWN";
  TAG_ID2[TAG_ID2["A"] = 1] = "A";
  TAG_ID2[TAG_ID2["ADDRESS"] = 2] = "ADDRESS";
  TAG_ID2[TAG_ID2["ANNOTATION_XML"] = 3] = "ANNOTATION_XML";
  TAG_ID2[TAG_ID2["APPLET"] = 4] = "APPLET";
  TAG_ID2[TAG_ID2["AREA"] = 5] = "AREA";
  TAG_ID2[TAG_ID2["ARTICLE"] = 6] = "ARTICLE";
  TAG_ID2[TAG_ID2["ASIDE"] = 7] = "ASIDE";
  TAG_ID2[TAG_ID2["B"] = 8] = "B";
  TAG_ID2[TAG_ID2["BASE"] = 9] = "BASE";
  TAG_ID2[TAG_ID2["BASEFONT"] = 10] = "BASEFONT";
  TAG_ID2[TAG_ID2["BGSOUND"] = 11] = "BGSOUND";
  TAG_ID2[TAG_ID2["BIG"] = 12] = "BIG";
  TAG_ID2[TAG_ID2["BLOCKQUOTE"] = 13] = "BLOCKQUOTE";
  TAG_ID2[TAG_ID2["BODY"] = 14] = "BODY";
  TAG_ID2[TAG_ID2["BR"] = 15] = "BR";
  TAG_ID2[TAG_ID2["BUTTON"] = 16] = "BUTTON";
  TAG_ID2[TAG_ID2["CAPTION"] = 17] = "CAPTION";
  TAG_ID2[TAG_ID2["CENTER"] = 18] = "CENTER";
  TAG_ID2[TAG_ID2["CODE"] = 19] = "CODE";
  TAG_ID2[TAG_ID2["COL"] = 20] = "COL";
  TAG_ID2[TAG_ID2["COLGROUP"] = 21] = "COLGROUP";
  TAG_ID2[TAG_ID2["DD"] = 22] = "DD";
  TAG_ID2[TAG_ID2["DESC"] = 23] = "DESC";
  TAG_ID2[TAG_ID2["DETAILS"] = 24] = "DETAILS";
  TAG_ID2[TAG_ID2["DIALOG"] = 25] = "DIALOG";
  TAG_ID2[TAG_ID2["DIR"] = 26] = "DIR";
  TAG_ID2[TAG_ID2["DIV"] = 27] = "DIV";
  TAG_ID2[TAG_ID2["DL"] = 28] = "DL";
  TAG_ID2[TAG_ID2["DT"] = 29] = "DT";
  TAG_ID2[TAG_ID2["EM"] = 30] = "EM";
  TAG_ID2[TAG_ID2["EMBED"] = 31] = "EMBED";
  TAG_ID2[TAG_ID2["FIELDSET"] = 32] = "FIELDSET";
  TAG_ID2[TAG_ID2["FIGCAPTION"] = 33] = "FIGCAPTION";
  TAG_ID2[TAG_ID2["FIGURE"] = 34] = "FIGURE";
  TAG_ID2[TAG_ID2["FONT"] = 35] = "FONT";
  TAG_ID2[TAG_ID2["FOOTER"] = 36] = "FOOTER";
  TAG_ID2[TAG_ID2["FOREIGN_OBJECT"] = 37] = "FOREIGN_OBJECT";
  TAG_ID2[TAG_ID2["FORM"] = 38] = "FORM";
  TAG_ID2[TAG_ID2["FRAME"] = 39] = "FRAME";
  TAG_ID2[TAG_ID2["FRAMESET"] = 40] = "FRAMESET";
  TAG_ID2[TAG_ID2["H1"] = 41] = "H1";
  TAG_ID2[TAG_ID2["H2"] = 42] = "H2";
  TAG_ID2[TAG_ID2["H3"] = 43] = "H3";
  TAG_ID2[TAG_ID2["H4"] = 44] = "H4";
  TAG_ID2[TAG_ID2["H5"] = 45] = "H5";
  TAG_ID2[TAG_ID2["H6"] = 46] = "H6";
  TAG_ID2[TAG_ID2["HEAD"] = 47] = "HEAD";
  TAG_ID2[TAG_ID2["HEADER"] = 48] = "HEADER";
  TAG_ID2[TAG_ID2["HGROUP"] = 49] = "HGROUP";
  TAG_ID2[TAG_ID2["HR"] = 50] = "HR";
  TAG_ID2[TAG_ID2["HTML"] = 51] = "HTML";
  TAG_ID2[TAG_ID2["I"] = 52] = "I";
  TAG_ID2[TAG_ID2["IMG"] = 53] = "IMG";
  TAG_ID2[TAG_ID2["IMAGE"] = 54] = "IMAGE";
  TAG_ID2[TAG_ID2["INPUT"] = 55] = "INPUT";
  TAG_ID2[TAG_ID2["IFRAME"] = 56] = "IFRAME";
  TAG_ID2[TAG_ID2["KEYGEN"] = 57] = "KEYGEN";
  TAG_ID2[TAG_ID2["LABEL"] = 58] = "LABEL";
  TAG_ID2[TAG_ID2["LI"] = 59] = "LI";
  TAG_ID2[TAG_ID2["LINK"] = 60] = "LINK";
  TAG_ID2[TAG_ID2["LISTING"] = 61] = "LISTING";
  TAG_ID2[TAG_ID2["MAIN"] = 62] = "MAIN";
  TAG_ID2[TAG_ID2["MALIGNMARK"] = 63] = "MALIGNMARK";
  TAG_ID2[TAG_ID2["MARQUEE"] = 64] = "MARQUEE";
  TAG_ID2[TAG_ID2["MATH"] = 65] = "MATH";
  TAG_ID2[TAG_ID2["MENU"] = 66] = "MENU";
  TAG_ID2[TAG_ID2["META"] = 67] = "META";
  TAG_ID2[TAG_ID2["MGLYPH"] = 68] = "MGLYPH";
  TAG_ID2[TAG_ID2["MI"] = 69] = "MI";
  TAG_ID2[TAG_ID2["MO"] = 70] = "MO";
  TAG_ID2[TAG_ID2["MN"] = 71] = "MN";
  TAG_ID2[TAG_ID2["MS"] = 72] = "MS";
  TAG_ID2[TAG_ID2["MTEXT"] = 73] = "MTEXT";
  TAG_ID2[TAG_ID2["NAV"] = 74] = "NAV";
  TAG_ID2[TAG_ID2["NOBR"] = 75] = "NOBR";
  TAG_ID2[TAG_ID2["NOFRAMES"] = 76] = "NOFRAMES";
  TAG_ID2[TAG_ID2["NOEMBED"] = 77] = "NOEMBED";
  TAG_ID2[TAG_ID2["NOSCRIPT"] = 78] = "NOSCRIPT";
  TAG_ID2[TAG_ID2["OBJECT"] = 79] = "OBJECT";
  TAG_ID2[TAG_ID2["OL"] = 80] = "OL";
  TAG_ID2[TAG_ID2["OPTGROUP"] = 81] = "OPTGROUP";
  TAG_ID2[TAG_ID2["OPTION"] = 82] = "OPTION";
  TAG_ID2[TAG_ID2["P"] = 83] = "P";
  TAG_ID2[TAG_ID2["PARAM"] = 84] = "PARAM";
  TAG_ID2[TAG_ID2["PLAINTEXT"] = 85] = "PLAINTEXT";
  TAG_ID2[TAG_ID2["PRE"] = 86] = "PRE";
  TAG_ID2[TAG_ID2["RB"] = 87] = "RB";
  TAG_ID2[TAG_ID2["RP"] = 88] = "RP";
  TAG_ID2[TAG_ID2["RT"] = 89] = "RT";
  TAG_ID2[TAG_ID2["RTC"] = 90] = "RTC";
  TAG_ID2[TAG_ID2["RUBY"] = 91] = "RUBY";
  TAG_ID2[TAG_ID2["S"] = 92] = "S";
  TAG_ID2[TAG_ID2["SCRIPT"] = 93] = "SCRIPT";
  TAG_ID2[TAG_ID2["SEARCH"] = 94] = "SEARCH";
  TAG_ID2[TAG_ID2["SECTION"] = 95] = "SECTION";
  TAG_ID2[TAG_ID2["SELECT"] = 96] = "SELECT";
  TAG_ID2[TAG_ID2["SOURCE"] = 97] = "SOURCE";
  TAG_ID2[TAG_ID2["SMALL"] = 98] = "SMALL";
  TAG_ID2[TAG_ID2["SPAN"] = 99] = "SPAN";
  TAG_ID2[TAG_ID2["STRIKE"] = 100] = "STRIKE";
  TAG_ID2[TAG_ID2["STRONG"] = 101] = "STRONG";
  TAG_ID2[TAG_ID2["STYLE"] = 102] = "STYLE";
  TAG_ID2[TAG_ID2["SUB"] = 103] = "SUB";
  TAG_ID2[TAG_ID2["SUMMARY"] = 104] = "SUMMARY";
  TAG_ID2[TAG_ID2["SUP"] = 105] = "SUP";
  TAG_ID2[TAG_ID2["TABLE"] = 106] = "TABLE";
  TAG_ID2[TAG_ID2["TBODY"] = 107] = "TBODY";
  TAG_ID2[TAG_ID2["TEMPLATE"] = 108] = "TEMPLATE";
  TAG_ID2[TAG_ID2["TEXTAREA"] = 109] = "TEXTAREA";
  TAG_ID2[TAG_ID2["TFOOT"] = 110] = "TFOOT";
  TAG_ID2[TAG_ID2["TD"] = 111] = "TD";
  TAG_ID2[TAG_ID2["TH"] = 112] = "TH";
  TAG_ID2[TAG_ID2["THEAD"] = 113] = "THEAD";
  TAG_ID2[TAG_ID2["TITLE"] = 114] = "TITLE";
  TAG_ID2[TAG_ID2["TR"] = 115] = "TR";
  TAG_ID2[TAG_ID2["TRACK"] = 116] = "TRACK";
  TAG_ID2[TAG_ID2["TT"] = 117] = "TT";
  TAG_ID2[TAG_ID2["U"] = 118] = "U";
  TAG_ID2[TAG_ID2["UL"] = 119] = "UL";
  TAG_ID2[TAG_ID2["SVG"] = 120] = "SVG";
  TAG_ID2[TAG_ID2["VAR"] = 121] = "VAR";
  TAG_ID2[TAG_ID2["WBR"] = 122] = "WBR";
  TAG_ID2[TAG_ID2["XMP"] = 123] = "XMP";
})(TAG_ID || (TAG_ID = {}));
var TAG_NAME_TO_ID = /* @__PURE__ */ new Map([
  [TAG_NAMES.A, TAG_ID.A],
  [TAG_NAMES.ADDRESS, TAG_ID.ADDRESS],
  [TAG_NAMES.ANNOTATION_XML, TAG_ID.ANNOTATION_XML],
  [TAG_NAMES.APPLET, TAG_ID.APPLET],
  [TAG_NAMES.AREA, TAG_ID.AREA],
  [TAG_NAMES.ARTICLE, TAG_ID.ARTICLE],
  [TAG_NAMES.ASIDE, TAG_ID.ASIDE],
  [TAG_NAMES.B, TAG_ID.B],
  [TAG_NAMES.BASE, TAG_ID.BASE],
  [TAG_NAMES.BASEFONT, TAG_ID.BASEFONT],
  [TAG_NAMES.BGSOUND, TAG_ID.BGSOUND],
  [TAG_NAMES.BIG, TAG_ID.BIG],
  [TAG_NAMES.BLOCKQUOTE, TAG_ID.BLOCKQUOTE],
  [TAG_NAMES.BODY, TAG_ID.BODY],
  [TAG_NAMES.BR, TAG_ID.BR],
  [TAG_NAMES.BUTTON, TAG_ID.BUTTON],
  [TAG_NAMES.CAPTION, TAG_ID.CAPTION],
  [TAG_NAMES.CENTER, TAG_ID.CENTER],
  [TAG_NAMES.CODE, TAG_ID.CODE],
  [TAG_NAMES.COL, TAG_ID.COL],
  [TAG_NAMES.COLGROUP, TAG_ID.COLGROUP],
  [TAG_NAMES.DD, TAG_ID.DD],
  [TAG_NAMES.DESC, TAG_ID.DESC],
  [TAG_NAMES.DETAILS, TAG_ID.DETAILS],
  [TAG_NAMES.DIALOG, TAG_ID.DIALOG],
  [TAG_NAMES.DIR, TAG_ID.DIR],
  [TAG_NAMES.DIV, TAG_ID.DIV],
  [TAG_NAMES.DL, TAG_ID.DL],
  [TAG_NAMES.DT, TAG_ID.DT],
  [TAG_NAMES.EM, TAG_ID.EM],
  [TAG_NAMES.EMBED, TAG_ID.EMBED],
  [TAG_NAMES.FIELDSET, TAG_ID.FIELDSET],
  [TAG_NAMES.FIGCAPTION, TAG_ID.FIGCAPTION],
  [TAG_NAMES.FIGURE, TAG_ID.FIGURE],
  [TAG_NAMES.FONT, TAG_ID.FONT],
  [TAG_NAMES.FOOTER, TAG_ID.FOOTER],
  [TAG_NAMES.FOREIGN_OBJECT, TAG_ID.FOREIGN_OBJECT],
  [TAG_NAMES.FORM, TAG_ID.FORM],
  [TAG_NAMES.FRAME, TAG_ID.FRAME],
  [TAG_NAMES.FRAMESET, TAG_ID.FRAMESET],
  [TAG_NAMES.H1, TAG_ID.H1],
  [TAG_NAMES.H2, TAG_ID.H2],
  [TAG_NAMES.H3, TAG_ID.H3],
  [TAG_NAMES.H4, TAG_ID.H4],
  [TAG_NAMES.H5, TAG_ID.H5],
  [TAG_NAMES.H6, TAG_ID.H6],
  [TAG_NAMES.HEAD, TAG_ID.HEAD],
  [TAG_NAMES.HEADER, TAG_ID.HEADER],
  [TAG_NAMES.HGROUP, TAG_ID.HGROUP],
  [TAG_NAMES.HR, TAG_ID.HR],
  [TAG_NAMES.HTML, TAG_ID.HTML],
  [TAG_NAMES.I, TAG_ID.I],
  [TAG_NAMES.IMG, TAG_ID.IMG],
  [TAG_NAMES.IMAGE, TAG_ID.IMAGE],
  [TAG_NAMES.INPUT, TAG_ID.INPUT],
  [TAG_NAMES.IFRAME, TAG_ID.IFRAME],
  [TAG_NAMES.KEYGEN, TAG_ID.KEYGEN],
  [TAG_NAMES.LABEL, TAG_ID.LABEL],
  [TAG_NAMES.LI, TAG_ID.LI],
  [TAG_NAMES.LINK, TAG_ID.LINK],
  [TAG_NAMES.LISTING, TAG_ID.LISTING],
  [TAG_NAMES.MAIN, TAG_ID.MAIN],
  [TAG_NAMES.MALIGNMARK, TAG_ID.MALIGNMARK],
  [TAG_NAMES.MARQUEE, TAG_ID.MARQUEE],
  [TAG_NAMES.MATH, TAG_ID.MATH],
  [TAG_NAMES.MENU, TAG_ID.MENU],
  [TAG_NAMES.META, TAG_ID.META],
  [TAG_NAMES.MGLYPH, TAG_ID.MGLYPH],
  [TAG_NAMES.MI, TAG_ID.MI],
  [TAG_NAMES.MO, TAG_ID.MO],
  [TAG_NAMES.MN, TAG_ID.MN],
  [TAG_NAMES.MS, TAG_ID.MS],
  [TAG_NAMES.MTEXT, TAG_ID.MTEXT],
  [TAG_NAMES.NAV, TAG_ID.NAV],
  [TAG_NAMES.NOBR, TAG_ID.NOBR],
  [TAG_NAMES.NOFRAMES, TAG_ID.NOFRAMES],
  [TAG_NAMES.NOEMBED, TAG_ID.NOEMBED],
  [TAG_NAMES.NOSCRIPT, TAG_ID.NOSCRIPT],
  [TAG_NAMES.OBJECT, TAG_ID.OBJECT],
  [TAG_NAMES.OL, TAG_ID.OL],
  [TAG_NAMES.OPTGROUP, TAG_ID.OPTGROUP],
  [TAG_NAMES.OPTION, TAG_ID.OPTION],
  [TAG_NAMES.P, TAG_ID.P],
  [TAG_NAMES.PARAM, TAG_ID.PARAM],
  [TAG_NAMES.PLAINTEXT, TAG_ID.PLAINTEXT],
  [TAG_NAMES.PRE, TAG_ID.PRE],
  [TAG_NAMES.RB, TAG_ID.RB],
  [TAG_NAMES.RP, TAG_ID.RP],
  [TAG_NAMES.RT, TAG_ID.RT],
  [TAG_NAMES.RTC, TAG_ID.RTC],
  [TAG_NAMES.RUBY, TAG_ID.RUBY],
  [TAG_NAMES.S, TAG_ID.S],
  [TAG_NAMES.SCRIPT, TAG_ID.SCRIPT],
  [TAG_NAMES.SEARCH, TAG_ID.SEARCH],
  [TAG_NAMES.SECTION, TAG_ID.SECTION],
  [TAG_NAMES.SELECT, TAG_ID.SELECT],
  [TAG_NAMES.SOURCE, TAG_ID.SOURCE],
  [TAG_NAMES.SMALL, TAG_ID.SMALL],
  [TAG_NAMES.SPAN, TAG_ID.SPAN],
  [TAG_NAMES.STRIKE, TAG_ID.STRIKE],
  [TAG_NAMES.STRONG, TAG_ID.STRONG],
  [TAG_NAMES.STYLE, TAG_ID.STYLE],
  [TAG_NAMES.SUB, TAG_ID.SUB],
  [TAG_NAMES.SUMMARY, TAG_ID.SUMMARY],
  [TAG_NAMES.SUP, TAG_ID.SUP],
  [TAG_NAMES.TABLE, TAG_ID.TABLE],
  [TAG_NAMES.TBODY, TAG_ID.TBODY],
  [TAG_NAMES.TEMPLATE, TAG_ID.TEMPLATE],
  [TAG_NAMES.TEXTAREA, TAG_ID.TEXTAREA],
  [TAG_NAMES.TFOOT, TAG_ID.TFOOT],
  [TAG_NAMES.TD, TAG_ID.TD],
  [TAG_NAMES.TH, TAG_ID.TH],
  [TAG_NAMES.THEAD, TAG_ID.THEAD],
  [TAG_NAMES.TITLE, TAG_ID.TITLE],
  [TAG_NAMES.TR, TAG_ID.TR],
  [TAG_NAMES.TRACK, TAG_ID.TRACK],
  [TAG_NAMES.TT, TAG_ID.TT],
  [TAG_NAMES.U, TAG_ID.U],
  [TAG_NAMES.UL, TAG_ID.UL],
  [TAG_NAMES.SVG, TAG_ID.SVG],
  [TAG_NAMES.VAR, TAG_ID.VAR],
  [TAG_NAMES.WBR, TAG_ID.WBR],
  [TAG_NAMES.XMP, TAG_ID.XMP]
]);
function getTagID(tagName) {
  var _a;
  return (_a = TAG_NAME_TO_ID.get(tagName)) !== null && _a !== void 0 ? _a : TAG_ID.UNKNOWN;
}
var $ = TAG_ID;
var SPECIAL_ELEMENTS = {
  [NS.HTML]: /* @__PURE__ */ new Set([
    $.ADDRESS,
    $.APPLET,
    $.AREA,
    $.ARTICLE,
    $.ASIDE,
    $.BASE,
    $.BASEFONT,
    $.BGSOUND,
    $.BLOCKQUOTE,
    $.BODY,
    $.BR,
    $.BUTTON,
    $.CAPTION,
    $.CENTER,
    $.COL,
    $.COLGROUP,
    $.DD,
    $.DETAILS,
    $.DIR,
    $.DIV,
    $.DL,
    $.DT,
    $.EMBED,
    $.FIELDSET,
    $.FIGCAPTION,
    $.FIGURE,
    $.FOOTER,
    $.FORM,
    $.FRAME,
    $.FRAMESET,
    $.H1,
    $.H2,
    $.H3,
    $.H4,
    $.H5,
    $.H6,
    $.HEAD,
    $.HEADER,
    $.HGROUP,
    $.HR,
    $.HTML,
    $.IFRAME,
    $.IMG,
    $.INPUT,
    $.LI,
    $.LINK,
    $.LISTING,
    $.MAIN,
    $.MARQUEE,
    $.MENU,
    $.META,
    $.NAV,
    $.NOEMBED,
    $.NOFRAMES,
    $.NOSCRIPT,
    $.OBJECT,
    $.OL,
    $.P,
    $.PARAM,
    $.PLAINTEXT,
    $.PRE,
    $.SCRIPT,
    $.SECTION,
    $.SELECT,
    $.SOURCE,
    $.STYLE,
    $.SUMMARY,
    $.TABLE,
    $.TBODY,
    $.TD,
    $.TEMPLATE,
    $.TEXTAREA,
    $.TFOOT,
    $.TH,
    $.THEAD,
    $.TITLE,
    $.TR,
    $.TRACK,
    $.UL,
    $.WBR,
    $.XMP
  ]),
  [NS.MATHML]: /* @__PURE__ */ new Set([$.MI, $.MO, $.MN, $.MS, $.MTEXT, $.ANNOTATION_XML]),
  [NS.SVG]: /* @__PURE__ */ new Set([$.TITLE, $.FOREIGN_OBJECT, $.DESC]),
  [NS.XLINK]: /* @__PURE__ */ new Set(),
  [NS.XML]: /* @__PURE__ */ new Set(),
  [NS.XMLNS]: /* @__PURE__ */ new Set()
};
var NUMBERED_HEADERS = /* @__PURE__ */ new Set([$.H1, $.H2, $.H3, $.H4, $.H5, $.H6]);
var UNESCAPED_TEXT = /* @__PURE__ */ new Set([
  TAG_NAMES.STYLE,
  TAG_NAMES.SCRIPT,
  TAG_NAMES.XMP,
  TAG_NAMES.IFRAME,
  TAG_NAMES.NOEMBED,
  TAG_NAMES.NOFRAMES,
  TAG_NAMES.PLAINTEXT
]);

// node_modules/parse5/dist/tokenizer/index.js
var ATTR_NAME_SET_THRESHOLD = 64;
var State;
(function(State2) {
  State2[State2["DATA"] = 0] = "DATA";
  State2[State2["RCDATA"] = 1] = "RCDATA";
  State2[State2["RAWTEXT"] = 2] = "RAWTEXT";
  State2[State2["SCRIPT_DATA"] = 3] = "SCRIPT_DATA";
  State2[State2["PLAINTEXT"] = 4] = "PLAINTEXT";
  State2[State2["TAG_OPEN"] = 5] = "TAG_OPEN";
  State2[State2["END_TAG_OPEN"] = 6] = "END_TAG_OPEN";
  State2[State2["TAG_NAME"] = 7] = "TAG_NAME";
  State2[State2["RCDATA_LESS_THAN_SIGN"] = 8] = "RCDATA_LESS_THAN_SIGN";
  State2[State2["RCDATA_END_TAG_OPEN"] = 9] = "RCDATA_END_TAG_OPEN";
  State2[State2["RCDATA_END_TAG_NAME"] = 10] = "RCDATA_END_TAG_NAME";
  State2[State2["RAWTEXT_LESS_THAN_SIGN"] = 11] = "RAWTEXT_LESS_THAN_SIGN";
  State2[State2["RAWTEXT_END_TAG_OPEN"] = 12] = "RAWTEXT_END_TAG_OPEN";
  State2[State2["RAWTEXT_END_TAG_NAME"] = 13] = "RAWTEXT_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_LESS_THAN_SIGN"] = 14] = "SCRIPT_DATA_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_END_TAG_OPEN"] = 15] = "SCRIPT_DATA_END_TAG_OPEN";
  State2[State2["SCRIPT_DATA_END_TAG_NAME"] = 16] = "SCRIPT_DATA_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_ESCAPE_START"] = 17] = "SCRIPT_DATA_ESCAPE_START";
  State2[State2["SCRIPT_DATA_ESCAPE_START_DASH"] = 18] = "SCRIPT_DATA_ESCAPE_START_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED"] = 19] = "SCRIPT_DATA_ESCAPED";
  State2[State2["SCRIPT_DATA_ESCAPED_DASH"] = 20] = "SCRIPT_DATA_ESCAPED_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED_DASH_DASH"] = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH";
  State2[State2["SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN"] = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_OPEN"] = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN";
  State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_NAME"] = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_START"] = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED"] = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH"] = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH"] = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN"] = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN";
  State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_END"] = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END";
  State2[State2["BEFORE_ATTRIBUTE_NAME"] = 31] = "BEFORE_ATTRIBUTE_NAME";
  State2[State2["ATTRIBUTE_NAME"] = 32] = "ATTRIBUTE_NAME";
  State2[State2["AFTER_ATTRIBUTE_NAME"] = 33] = "AFTER_ATTRIBUTE_NAME";
  State2[State2["BEFORE_ATTRIBUTE_VALUE"] = 34] = "BEFORE_ATTRIBUTE_VALUE";
  State2[State2["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
  State2[State2["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
  State2[State2["ATTRIBUTE_VALUE_UNQUOTED"] = 37] = "ATTRIBUTE_VALUE_UNQUOTED";
  State2[State2["AFTER_ATTRIBUTE_VALUE_QUOTED"] = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED";
  State2[State2["SELF_CLOSING_START_TAG"] = 39] = "SELF_CLOSING_START_TAG";
  State2[State2["BOGUS_COMMENT"] = 40] = "BOGUS_COMMENT";
  State2[State2["MARKUP_DECLARATION_OPEN"] = 41] = "MARKUP_DECLARATION_OPEN";
  State2[State2["COMMENT_START"] = 42] = "COMMENT_START";
  State2[State2["COMMENT_START_DASH"] = 43] = "COMMENT_START_DASH";
  State2[State2["COMMENT"] = 44] = "COMMENT";
  State2[State2["COMMENT_LESS_THAN_SIGN"] = 45] = "COMMENT_LESS_THAN_SIGN";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG"] = 46] = "COMMENT_LESS_THAN_SIGN_BANG";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH"] = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH";
  State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH"] = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH";
  State2[State2["COMMENT_END_DASH"] = 49] = "COMMENT_END_DASH";
  State2[State2["COMMENT_END"] = 50] = "COMMENT_END";
  State2[State2["COMMENT_END_BANG"] = 51] = "COMMENT_END_BANG";
  State2[State2["DOCTYPE"] = 52] = "DOCTYPE";
  State2[State2["BEFORE_DOCTYPE_NAME"] = 53] = "BEFORE_DOCTYPE_NAME";
  State2[State2["DOCTYPE_NAME"] = 54] = "DOCTYPE_NAME";
  State2[State2["AFTER_DOCTYPE_NAME"] = 55] = "AFTER_DOCTYPE_NAME";
  State2[State2["AFTER_DOCTYPE_PUBLIC_KEYWORD"] = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD";
  State2[State2["BEFORE_DOCTYPE_PUBLIC_IDENTIFIER"] = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER";
  State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED"] = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED";
  State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED"] = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED";
  State2[State2["AFTER_DOCTYPE_PUBLIC_IDENTIFIER"] = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER";
  State2[State2["BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS"] = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS";
  State2[State2["AFTER_DOCTYPE_SYSTEM_KEYWORD"] = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD";
  State2[State2["BEFORE_DOCTYPE_SYSTEM_IDENTIFIER"] = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER";
  State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED"] = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED";
  State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED"] = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED";
  State2[State2["AFTER_DOCTYPE_SYSTEM_IDENTIFIER"] = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER";
  State2[State2["BOGUS_DOCTYPE"] = 67] = "BOGUS_DOCTYPE";
  State2[State2["CDATA_SECTION"] = 68] = "CDATA_SECTION";
  State2[State2["CDATA_SECTION_BRACKET"] = 69] = "CDATA_SECTION_BRACKET";
  State2[State2["CDATA_SECTION_END"] = 70] = "CDATA_SECTION_END";
  State2[State2["CHARACTER_REFERENCE"] = 71] = "CHARACTER_REFERENCE";
  State2[State2["AMBIGUOUS_AMPERSAND"] = 72] = "AMBIGUOUS_AMPERSAND";
})(State || (State = {}));
var TokenizerMode = {
  DATA: State.DATA,
  RCDATA: State.RCDATA,
  RAWTEXT: State.RAWTEXT,
  SCRIPT_DATA: State.SCRIPT_DATA,
  PLAINTEXT: State.PLAINTEXT,
  CDATA_SECTION: State.CDATA_SECTION
};
function isAsciiDigit(cp) {
  return cp >= CODE_POINTS.DIGIT_0 && cp <= CODE_POINTS.DIGIT_9;
}
function isAsciiUpper(cp) {
  return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_Z;
}
function isAsciiLower(cp) {
  return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_Z;
}
function isAsciiLetter(cp) {
  return isAsciiLower(cp) || isAsciiUpper(cp);
}
function isAsciiAlphaNumeric(cp) {
  return isAsciiLetter(cp) || isAsciiDigit(cp);
}
function toAsciiLower(cp) {
  return cp + 32;
}
function isWhitespace(cp) {
  return cp === CODE_POINTS.SPACE || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.TABULATION || cp === CODE_POINTS.FORM_FEED || cp === CODE_POINTS.CARRIAGE_RETURN;
}
function isScriptDataDoubleEscapeSequenceEnd(cp) {
  return isWhitespace(cp) || cp === CODE_POINTS.SOLIDUS || cp === CODE_POINTS.GREATER_THAN_SIGN;
}
function getErrorForNumericCharacterReference(code) {
  if (code === CODE_POINTS.NULL) {
    return ERR.nullCharacterReference;
  } else if (code > 1114111) {
    return ERR.characterReferenceOutsideUnicodeRange;
  } else if (isSurrogate(code)) {
    return ERR.surrogateCharacterReference;
  } else if (isUndefinedCodePoint(code)) {
    return ERR.noncharacterCharacterReference;
  } else if (isControlCodePoint(code) || code === CODE_POINTS.CARRIAGE_RETURN) {
    return ERR.controlCharacterReference;
  }
  return null;
}
var Tokenizer = class {
  constructor(options, handler) {
    this.options = options;
    this.handler = handler;
    this.paused = false;
    this.inLoop = false;
    this.inForeignNode = false;
    this.lastStartTagName = "";
    this.active = false;
    this.state = State.DATA;
    this.returnState = State.DATA;
    this.entityStartPos = 0;
    this.consumedAfterSnapshot = -1;
    this.currentCharacterToken = null;
    this.currentToken = null;
    this.currentAttr = { name: "", value: "" };
    this.currentAttrLocation = null;
    this.currentAttrNames = null;
    this.runStart = 0;
    this.runEnd = 0;
    this.preprocessor = new Preprocessor(handler);
    this.currentLocation = this.getCurrentLocation(-1);
    this.entityDecoder = new HtmlEntityDecoder((cp, consumed) => {
      this.preprocessor.pos = this.entityStartPos + consumed - 1;
      if (!this._isCharacterReferenceInAttribute()) {
        this._ensureCharacterToken(isWhitespace(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER);
      }
      this._extendRunWith(String.fromCodePoint(cp), 0);
      this.entityStartPos = this.preprocessor.pos - consumed + 1;
    }, handler.onParseError ? {
      missingSemicolonAfterCharacterReference: () => {
        this._err(ERR.missingSemicolonAfterCharacterReference, 1);
      },
      absenceOfDigitsInNumericCharacterReference: (consumed) => {
        this._err(ERR.absenceOfDigitsInNumericCharacterReference, this.entityStartPos - this.preprocessor.pos + consumed);
      },
      validateNumericCharacterReference: (code) => {
        const error = getErrorForNumericCharacterReference(code);
        if (error)
          this._err(error, 1);
      }
    } : void 0);
  }
  //Errors
  _err(code, cpOffset = 0) {
    var _a, _b;
    (_b = (_a = this.handler).onParseError) === null || _b === void 0 ? void 0 : _b.call(_a, this.preprocessor.getError(code, cpOffset));
  }
  // NOTE: `offset` may never run across line boundaries.
  getCurrentLocation(offset2) {
    if (!this.options.sourceCodeLocationInfo) {
      return null;
    }
    return {
      startLine: this.preprocessor.line,
      startCol: this.preprocessor.col - offset2,
      startOffset: this.preprocessor.offset - offset2,
      endLine: -1,
      endCol: -1,
      endOffset: -1
    };
  }
  _runParsingLoop() {
    if (this.inLoop)
      return;
    this.inLoop = true;
    while (this.active && !this.paused) {
      this.consumedAfterSnapshot = 0;
      const cp = this._consume();
      if (!this._ensureHibernation()) {
        this._callState(cp);
      }
    }
    this.inLoop = false;
  }
  //API
  /** Emit buffered character tokens without completing the current token or emitting EOF. */
  flushCharacters() {
    var _a;
    if (this.inLoop) {
      throw new Error("Cannot flush characters from a tokenizer callback");
    }
    const location = (_a = this.currentCharacterToken) === null || _a === void 0 ? void 0 : _a.location;
    let nextLocation = null;
    if (location) {
      nextLocation = this.getCharacterTokenEndLocation(location);
      this.currentLocation = nextLocation;
    }
    this.inLoop = true;
    try {
      this._emitCurrentCharacterToken(nextLocation);
    } finally {
      this.inLoop = false;
    }
    this._runParsingLoop();
  }
  getCharacterTokenEndLocation(location) {
    const endOffset = this.getCharacterTokenEndOffset();
    const html = this.preprocessor.html.slice(location.startOffset - this.preprocessor.droppedBufferSize, endOffset - this.preprocessor.droppedBufferSize);
    let line = location.startLine;
    let lastLineBreak = -1;
    for (let i2 = html.indexOf("\n"); i2 !== -1; i2 = html.indexOf("\n", i2 + 1)) {
      line++;
      lastLineBreak = i2;
    }
    for (let i2 = html.indexOf("\r"); i2 !== -1; i2 = html.indexOf("\r", i2 + 1)) {
      if (html.charCodeAt(i2 + 1) !== CODE_POINTS.LINE_FEED) {
        line++;
        lastLineBreak = Math.max(lastLineBreak, i2);
      }
    }
    return {
      startLine: line,
      startCol: lastLineBreak === -1 ? location.startCol + html.length : html.length - lastLineBreak,
      startOffset: endOffset,
      endLine: -1,
      endCol: -1,
      endOffset: -1
    };
  }
  // Return the input boundary before any unfinished token or buffered delimiter.
  getCharacterTokenEndOffset() {
    var _a;
    const end = this.preprocessor.droppedBufferSize + this.preprocessor.pos + 1;
    const tokenLocation = (_a = this.currentToken) === null || _a === void 0 ? void 0 : _a.location;
    switch (this.state) {
      case State.TAG_OPEN:
      case State.RCDATA_LESS_THAN_SIGN:
      case State.RAWTEXT_LESS_THAN_SIGN:
      case State.SCRIPT_DATA_LESS_THAN_SIGN:
      case State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN:
      case State.CDATA_SECTION_BRACKET: {
        return end - 1;
      }
      case State.END_TAG_OPEN:
      case State.MARKUP_DECLARATION_OPEN:
      case State.RCDATA_END_TAG_OPEN:
      case State.RCDATA_END_TAG_NAME:
      case State.RAWTEXT_END_TAG_OPEN:
      case State.RAWTEXT_END_TAG_NAME:
      case State.SCRIPT_DATA_END_TAG_OPEN:
      case State.SCRIPT_DATA_END_TAG_NAME:
      case State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN:
      case State.SCRIPT_DATA_ESCAPED_END_TAG_NAME:
      case State.CDATA_SECTION_END: {
        return end - 2;
      }
      case State.CHARACTER_REFERENCE: {
        return this._isCharacterReferenceInAttribute() && tokenLocation ? tokenLocation.startOffset : this.preprocessor.droppedBufferSize + this.entityStartPos;
      }
      case State.DOCTYPE:
      case State.BEFORE_DOCTYPE_NAME: {
        return this.currentLocation.startOffset;
      }
      default: {
        if (tokenLocation && (this.state === State.TAG_NAME || this.state >= State.BEFORE_ATTRIBUTE_NAME && this.state <= State.BOGUS_COMMENT || this.state >= State.COMMENT_START && this.state <= State.BOGUS_DOCTYPE)) {
          return tokenLocation.startOffset;
        }
        return end;
      }
    }
  }
  pause() {
    this.paused = true;
  }
  resume(writeCallback) {
    if (!this.paused) {
      throw new Error("Parser was already resumed");
    }
    this.paused = false;
    if (this.inLoop)
      return;
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
    }
  }
  write(chunk, isLastChunk, writeCallback) {
    this.active = true;
    this.preprocessor.write(chunk, isLastChunk);
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
    }
  }
  insertHtmlAtCurrentPos(chunk) {
    this.active = true;
    this.preprocessor.insertHtmlAtCurrentPos(chunk);
    this._runParsingLoop();
  }
  /** @internal Flush completed streaming text without splitting an unfinished token. */
  flushCurrentCharacterToken() {
    if (this.paused || this.active || !this.currentCharacterToken || this.currentToken || this.state === State.DOCTYPE || this.state === State.BEFORE_DOCTYPE_NAME || !this.preprocessor.willDropParsedChunk()) {
      return;
    }
    const pending = this.preprocessor.droppedBufferSize + this.preprocessor.pos + 1 - this.getCharacterTokenEndOffset();
    this.preprocessor.advance();
    this.currentLocation = this.getCurrentLocation(pending);
    this.preprocessor.retreat(1);
    this._emitCurrentCharacterToken(this.currentLocation);
    this._createCharacterToken(TokenType.CHARACTER);
    this.preprocessor.dropParsedChunk(Math.max(pending - 1, 0));
    this.entityStartPos = this.preprocessor.pos + 1 - pending;
  }
  //Hibernation
  _ensureHibernation() {
    if (this.preprocessor.endOfChunkHit) {
      this.preprocessor.retreat(this.consumedAfterSnapshot);
      this.consumedAfterSnapshot = 0;
      this.active = false;
      return true;
    }
    return false;
  }
  //Consumption
  _consume() {
    this.consumedAfterSnapshot++;
    return this.preprocessor.advance();
  }
  _advanceBy(count) {
    this.consumedAfterSnapshot += count;
    for (let i2 = 0; i2 < count; i2++) {
      this.preprocessor.advance();
    }
  }
  _consumeSequenceIfMatch(pattern, caseSensitive) {
    if (this.preprocessor.startsWith(pattern, caseSensitive)) {
      this._advanceBy(pattern.length - 1);
      return true;
    }
    return false;
  }
  //Token creation
  _createStartTagToken() {
    this._flushRun("");
    this.currentToken = {
      type: TokenType.START_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(1)
    };
  }
  _createEndTagToken() {
    this._flushRun("");
    this.currentToken = {
      type: TokenType.END_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(2)
    };
  }
  _createCommentToken(offset2) {
    this._flushRun("");
    this.currentToken = {
      type: TokenType.COMMENT,
      data: "",
      location: this.getCurrentLocation(offset2)
    };
  }
  _createDoctypeToken(initialName) {
    this._flushRun("");
    this.currentToken = {
      type: TokenType.DOCTYPE,
      name: initialName,
      forceQuirks: false,
      publicId: null,
      systemId: null,
      location: this.currentLocation
    };
  }
  _createCharacterToken(type) {
    if (this.currentLocation) {
      const start = this.currentLocation.startOffset - this.preprocessor.droppedBufferSize;
      if (this.preprocessor.html[start] === "\n" && this.preprocessor.html[start - 1] === "\r") {
        this.currentLocation.startOffset++;
      }
    }
    this.currentCharacterToken = {
      type,
      chars: "",
      location: this.currentLocation
    };
  }
  //Tag attributes
  _createAttr(attrNameFirstCh) {
    this._flushRun("");
    this.currentAttr = {
      name: attrNameFirstCh,
      value: ""
    };
    this.currentAttrLocation = this.getCurrentLocation(0);
  }
  _leaveAttrName() {
    var _a;
    var _b;
    const token = this.currentToken;
    const { name } = this.currentAttr;
    const names = this.currentAttrNames;
    let duplicate;
    if (names === null) {
      duplicate = getTokenAttr(token, name) !== null;
      if (!duplicate && token.attrs.length === ATTR_NAME_SET_THRESHOLD) {
        this.currentAttrNames = new Set(token.attrs.map((attr) => attr.name)).add(name);
      }
    } else {
      duplicate = names.has(name);
      if (!duplicate)
        names.add(name);
    }
    if (duplicate) {
      this._err(ERR.duplicateAttribute);
    } else {
      token.attrs.push(this.currentAttr);
      if (token.location && this.currentAttrLocation) {
        const attrLocations = (_a = (_b = token.location).attrs) !== null && _a !== void 0 ? _a : _b.attrs = /* @__PURE__ */ Object.create(null);
        attrLocations[this.currentAttr.name] = this.currentAttrLocation;
        this._leaveAttrValue();
      }
    }
  }
  _leaveAttrValue() {
    if (this.currentAttrLocation) {
      this.currentAttrLocation.endLine = this.preprocessor.line;
      this.currentAttrLocation.endCol = this.preprocessor.col;
      this.currentAttrLocation.endOffset = this.preprocessor.offset;
    }
  }
  /**
   * Append the pending run and `text` to the attribute value, comment data or character token being built.
   * The run is a string of its own: V8 copies a slice of fewer than 13 characters but lets a longer one share
   * the input's buffer, which would keep that buffer alive for as long as any attribute value or text cut from
   * it is; a concatenation is flattened into a buffer of its own when it is sliced.
   */
  _flushRun(text) {
    if (this.runEnd === this.runStart && text.length === 0) {
      return;
    }
    const slice = this.preprocessor.html.slice(this.runStart, this.runEnd);
    const run = (slice.length < 13 ? slice : ` ${slice}`.slice(1)) + text;
    const token = this.currentToken;
    this.runStart = this.runEnd;
    if (token === null) {
      this.currentCharacterToken.chars += run;
    } else if (token.type === TokenType.COMMENT) {
      token.data += run;
    } else {
      this.currentAttr.value += run;
    }
  }
  /** Extend the pending run by the current input code point, read as `cp`, or flush it and start a new one. */
  _extendRun(cp) {
    const { preprocessor } = this;
    if (cp === CODE_POINTS.LINE_FEED && preprocessor.html.charCodeAt(preprocessor.pos) !== CODE_POINTS.LINE_FEED) {
      this._flushRun("\n");
      this.runStart = preprocessor.pos + 1;
    } else {
      const start = preprocessor.pos - Number(cp > 65535);
      if (start !== this.runEnd) {
        this._flushRun("");
        this.runStart = start;
      }
    }
    this.runEnd = preprocessor.pos + 1;
  }
  /**
   * Extend the pending run by `text`, the input that ends `cpOffset` code points after the current one, or flush
   * the run and append `text` where the input differs (a NUL replacement, a decoded reference, a dropped chunk).
   */
  _extendRunWith(text, cpOffset) {
    const { preprocessor } = this;
    const start = preprocessor.codePointStart + 1 + cpOffset - text.length;
    if (start >= 0 && preprocessor.html.startsWith(text, start)) {
      if (start !== this.runEnd) {
        this._flushRun("");
        this.runStart = start;
      }
    } else {
      this._flushRun(text);
      this.runStart = start + text.length;
    }
    this.runEnd = start + text.length;
  }
  //Token emission
  prepareToken(ct) {
    this._emitCurrentCharacterToken(ct.location);
    this.currentToken = null;
    if (ct.location) {
      ct.location.endLine = this.preprocessor.line;
      ct.location.endCol = this.preprocessor.col + 1;
      ct.location.endOffset = this.preprocessor.offset + 1;
    }
    this.currentLocation = this.getCurrentLocation(-1);
  }
  emitCurrentTagToken() {
    const ct = this.currentToken;
    this.currentAttrNames = null;
    this.prepareToken(ct);
    ct.tagID = getTagID(ct.tagName);
    if (ct.type === TokenType.START_TAG) {
      this.lastStartTagName = ct.tagName;
      this.handler.onStartTag(ct);
    } else {
      if (ct.attrs.length > 0) {
        this._err(ERR.endTagWithAttributes);
      }
      if (ct.selfClosing) {
        this._err(ERR.endTagWithTrailingSolidus);
      }
      this.handler.onEndTag(ct);
    }
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentComment(ct) {
    this.prepareToken(ct);
    this.handler.onComment(ct);
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentDoctype(ct) {
    this.prepareToken(ct);
    this.handler.onDoctype(ct);
    this.preprocessor.dropParsedChunk();
  }
  _emitCurrentCharacterToken(nextLocation) {
    this._flushRun("");
    if (this.currentCharacterToken) {
      if (nextLocation && this.currentCharacterToken.location) {
        this.currentCharacterToken.location.endLine = nextLocation.startLine;
        this.currentCharacterToken.location.endCol = nextLocation.startCol;
        this.currentCharacterToken.location.endOffset = nextLocation.startOffset;
      }
      switch (this.currentCharacterToken.type) {
        case TokenType.CHARACTER: {
          this.handler.onCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.NULL_CHARACTER: {
          this.handler.onNullCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          this.handler.onWhitespaceCharacter(this.currentCharacterToken);
          break;
        }
      }
      this.currentCharacterToken = null;
    }
  }
  _emitEOFToken() {
    var _a, _b;
    const location = this.getCurrentLocation(0);
    if (location) {
      location.endLine = location.startLine;
      location.endCol = location.startCol;
      location.endOffset = location.startOffset;
    }
    this._emitCurrentCharacterToken((_b = (_a = this.currentToken) === null || _a === void 0 ? void 0 : _a.location) !== null && _b !== void 0 ? _b : location);
    this.handler.onEof({ type: TokenType.EOF, location });
    this.active = false;
  }
  //Characters emission
  //OPTIMIZATION: The specification uses only one type of character token (one token per character).
  //This causes a huge memory overhead and a lot of unnecessary parser loops. parse5 uses 3 groups of characters.
  //If we have a sequence of characters that belong to the same group, the parser can process it
  //as a single solid character token.
  //So, there are 3 types of character tokens in parse5:
  //1)TokenType.NULL_CHARACTER - \u0000-character sequences (e.g. '\u0000\u0000\u0000')
  //2)TokenType.WHITESPACE_CHARACTER - any whitespace/new-line character sequences (e.g. '\n  \r\t   \f')
  //3)TokenType.CHARACTER - any character sequence which don't belong to groups 1 and 2 (e.g. 'abcdef1234@@#$%^')
  /** Make the current character token one of `type`, emitting the current one if it has another type. */
  _ensureCharacterToken(type) {
    if (this.currentCharacterToken) {
      if (this.currentCharacterToken.type === type) {
        return;
      }
      this.currentLocation = this.getCurrentLocation(0);
      this._emitCurrentCharacterToken(this.currentLocation);
      this.preprocessor.dropParsedChunk();
    }
    this._createCharacterToken(type);
  }
  /** Emit the current input code point, read as `cp`. */
  _emitCodePoint(cp) {
    const type = isWhitespace(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER;
    const token = this.currentCharacterToken;
    if (token === null || token.type !== type) {
      this._ensureCharacterToken(type);
    }
    this._extendRun(cp);
  }
  //NOTE: used when we emit characters explicitly.
  //This is always for non-whitespace and non-null characters, which allows us to avoid additional checks.
  // Negative `cpOffset` values locate text emitted before the current input character.
  _emitChars(ch, cpOffset = 0) {
    if (this.options.sourceCodeLocationInfo && cpOffset !== 0 && this.currentCharacterToken && this.currentCharacterToken.type !== TokenType.CHARACTER) {
      this.currentLocation = this.getCurrentLocation(ch.length - 1 - cpOffset);
      this._emitCurrentCharacterToken(this.currentLocation);
      this._createCharacterToken(TokenType.CHARACTER);
    } else {
      this._ensureCharacterToken(TokenType.CHARACTER);
    }
    this._extendRunWith(ch, cpOffset);
  }
  // Character reference helpers
  _startCharacterReference() {
    this.returnState = this.state;
    this.state = State.CHARACTER_REFERENCE;
    this.entityStartPos = this.preprocessor.pos;
    this.entityDecoder.startEntity(this._isCharacterReferenceInAttribute() ? DecodingMode.Attribute : DecodingMode.Legacy);
  }
  _isCharacterReferenceInAttribute() {
    return this.returnState === State.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_UNQUOTED;
  }
  _flushCodePointConsumedAsCharacterReference(cp) {
    if (this._isCharacterReferenceInAttribute()) {
      this._extendRun(cp);
    } else {
      this._emitCodePoint(cp);
    }
  }
  // Calling states this way turns out to be much faster than any other approach.
  _callState(cp) {
    switch (this.state) {
      case State.DATA: {
        this._stateData(cp);
        break;
      }
      case State.RCDATA: {
        this._stateRcdata(cp);
        break;
      }
      case State.RAWTEXT: {
        this._stateRawtext(cp);
        break;
      }
      case State.SCRIPT_DATA: {
        this._stateScriptData(cp);
        break;
      }
      case State.PLAINTEXT: {
        this._statePlaintext(cp);
        break;
      }
      case State.TAG_OPEN: {
        this._stateTagOpen(cp);
        break;
      }
      case State.END_TAG_OPEN: {
        this._stateEndTagOpen(cp);
        break;
      }
      case State.TAG_NAME: {
        this._stateTagName(cp);
        break;
      }
      case State.RCDATA_LESS_THAN_SIGN: {
        this._stateRcdataLessThanSign(cp);
        break;
      }
      case State.RCDATA_END_TAG_OPEN: {
        this._stateRcdataEndTagOpen(cp);
        break;
      }
      case State.RCDATA_END_TAG_NAME: {
        this._stateRcdataEndTagName(cp);
        break;
      }
      case State.RAWTEXT_LESS_THAN_SIGN: {
        this._stateRawtextLessThanSign(cp);
        break;
      }
      case State.RAWTEXT_END_TAG_OPEN: {
        this._stateRawtextEndTagOpen(cp);
        break;
      }
      case State.RAWTEXT_END_TAG_NAME: {
        this._stateRawtextEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_LESS_THAN_SIGN: {
        this._stateScriptDataLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_END_TAG_OPEN: {
        this._stateScriptDataEndTagOpen(cp);
        break;
      }
      case State.SCRIPT_DATA_END_TAG_NAME: {
        this._stateScriptDataEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPE_START: {
        this._stateScriptDataEscapeStart(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPE_START_DASH: {
        this._stateScriptDataEscapeStartDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED: {
        this._stateScriptDataEscaped(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_DASH: {
        this._stateScriptDataEscapedDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_DASH_DASH: {
        this._stateScriptDataEscapedDashDash(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataEscapedLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: {
        this._stateScriptDataEscapedEndTagOpen(cp);
        break;
      }
      case State.SCRIPT_DATA_ESCAPED_END_TAG_NAME: {
        this._stateScriptDataEscapedEndTagName(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_START: {
        this._stateScriptDataDoubleEscapeStart(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED: {
        this._stateScriptDataDoubleEscaped(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: {
        this._stateScriptDataDoubleEscapedDash(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: {
        this._stateScriptDataDoubleEscapedDashDash(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataDoubleEscapedLessThanSign(cp);
        break;
      }
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_END: {
        this._stateScriptDataDoubleEscapeEnd(cp);
        break;
      }
      case State.BEFORE_ATTRIBUTE_NAME: {
        this._stateBeforeAttributeName(cp);
        break;
      }
      case State.ATTRIBUTE_NAME: {
        this._stateAttributeName(cp);
        break;
      }
      case State.AFTER_ATTRIBUTE_NAME: {
        this._stateAfterAttributeName(cp);
        break;
      }
      case State.BEFORE_ATTRIBUTE_VALUE: {
        this._stateBeforeAttributeValue(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
        this._stateAttributeValueDoubleQuoted(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_SINGLE_QUOTED: {
        this._stateAttributeValueSingleQuoted(cp);
        break;
      }
      case State.ATTRIBUTE_VALUE_UNQUOTED: {
        this._stateAttributeValueUnquoted(cp);
        break;
      }
      case State.AFTER_ATTRIBUTE_VALUE_QUOTED: {
        this._stateAfterAttributeValueQuoted(cp);
        break;
      }
      case State.SELF_CLOSING_START_TAG: {
        this._stateSelfClosingStartTag(cp);
        break;
      }
      case State.BOGUS_COMMENT: {
        this._stateBogusComment(cp);
        break;
      }
      case State.MARKUP_DECLARATION_OPEN: {
        this._stateMarkupDeclarationOpen(cp);
        break;
      }
      case State.COMMENT_START: {
        this._stateCommentStart(cp);
        break;
      }
      case State.COMMENT_START_DASH: {
        this._stateCommentStartDash(cp);
        break;
      }
      case State.COMMENT: {
        this._stateComment(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN: {
        this._stateCommentLessThanSign(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG: {
        this._stateCommentLessThanSignBang(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH: {
        this._stateCommentLessThanSignBangDash(cp);
        break;
      }
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
        this._stateCommentLessThanSignBangDashDash(cp);
        break;
      }
      case State.COMMENT_END_DASH: {
        this._stateCommentEndDash(cp);
        break;
      }
      case State.COMMENT_END: {
        this._stateCommentEnd(cp);
        break;
      }
      case State.COMMENT_END_BANG: {
        this._stateCommentEndBang(cp);
        break;
      }
      case State.DOCTYPE: {
        this._stateDoctype(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_NAME: {
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case State.DOCTYPE_NAME: {
        this._stateDoctypeName(cp);
        break;
      }
      case State.AFTER_DOCTYPE_NAME: {
        this._stateAfterDoctypeName(cp);
        break;
      }
      case State.AFTER_DOCTYPE_PUBLIC_KEYWORD: {
        this._stateAfterDoctypePublicKeyword(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateBeforeDoctypePublicIdentifier(cp);
        break;
      }
      case State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypePublicIdentifierDoubleQuoted(cp);
        break;
      }
      case State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypePublicIdentifierSingleQuoted(cp);
        break;
      }
      case State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateAfterDoctypePublicIdentifier(cp);
        break;
      }
      case State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: {
        this._stateBetweenDoctypePublicAndSystemIdentifiers(cp);
        break;
      }
      case State.AFTER_DOCTYPE_SYSTEM_KEYWORD: {
        this._stateAfterDoctypeSystemKeyword(cp);
        break;
      }
      case State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateBeforeDoctypeSystemIdentifier(cp);
        break;
      }
      case State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypeSystemIdentifierDoubleQuoted(cp);
        break;
      }
      case State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypeSystemIdentifierSingleQuoted(cp);
        break;
      }
      case State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateAfterDoctypeSystemIdentifier(cp);
        break;
      }
      case State.BOGUS_DOCTYPE: {
        this._stateBogusDoctype(cp);
        break;
      }
      case State.CDATA_SECTION: {
        this._stateCdataSection(cp);
        break;
      }
      case State.CDATA_SECTION_BRACKET: {
        this._stateCdataSectionBracket(cp);
        break;
      }
      case State.CDATA_SECTION_END: {
        this._stateCdataSectionEnd(cp);
        break;
      }
      case State.CHARACTER_REFERENCE: {
        this._stateCharacterReference();
        break;
      }
      case State.AMBIGUOUS_AMPERSAND: {
        this._stateAmbiguousAmpersand(cp);
        break;
      }
      default: {
        throw new Error("Unknown state");
      }
    }
  }
  // State machine
  // Data state
  //------------------------------------------------------------------
  _stateData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.TAG_OPEN;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitCodePoint(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  //  RCDATA state
  //------------------------------------------------------------------
  _stateRcdata(cp) {
    switch (cp) {
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.RCDATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // RAWTEXT state
  //------------------------------------------------------------------
  _stateRawtext(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.RAWTEXT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data state
  //------------------------------------------------------------------
  _stateScriptData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // PLAINTEXT state
  //------------------------------------------------------------------
  _statePlaintext(cp) {
    switch (cp) {
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Tag open state
  //------------------------------------------------------------------
  _stateTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createStartTagToken();
      this.state = State.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State.MARKUP_DECLARATION_OPEN;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State.END_TAG_OPEN;
          break;
        }
        case CODE_POINTS.QUESTION_MARK: {
          this._err(ERR.unexpectedQuestionMarkInsteadOfTagName);
          this._createCommentToken(1);
          this.state = State.BOGUS_COMMENT;
          this._stateBogusComment(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("<", -1);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._emitChars("<", -1);
          this.state = State.DATA;
          this._stateData(cp);
        }
      }
  }
  // End tag open state
  //------------------------------------------------------------------
  _stateEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createEndTagToken();
      this.state = State.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingEndTagName);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("</", -1);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._createCommentToken(2);
          this.state = State.BOGUS_COMMENT;
          this._stateBogusComment(cp);
        }
      }
  }
  // Tag name state
  //------------------------------------------------------------------
  _stateTagName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.tagName += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        token.tagName += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // RCDATA less-than sign state
  //------------------------------------------------------------------
  _stateRcdataLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.RCDATA_END_TAG_OPEN;
    } else {
      this._emitChars("<", -1);
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  // RCDATA end tag open state
  //------------------------------------------------------------------
  _stateRcdataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.RCDATA_END_TAG_NAME;
      this._stateRcdataEndTagName(cp);
    } else {
      this._emitChars("</", -1);
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  handleSpecialEndTag(_cp) {
    if (!this.preprocessor.startsWith(this.lastStartTagName, false)) {
      return !this._ensureHibernation();
    }
    this._createEndTagToken();
    const token = this.currentToken;
    token.tagName = this.lastStartTagName;
    const cp = this.preprocessor.peek(this.lastStartTagName.length);
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        return false;
      }
      case CODE_POINTS.SOLIDUS: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State.SELF_CLOSING_START_TAG;
        return false;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._advanceBy(this.lastStartTagName.length);
        this.emitCurrentTagToken();
        this.state = State.DATA;
        return false;
      }
      default: {
        this.currentToken = null;
        return !this._ensureHibernation();
      }
    }
  }
  // RCDATA end tag name state
  //------------------------------------------------------------------
  _stateRcdataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</", -1);
      this.state = State.RCDATA;
      this._stateRcdata(cp);
    }
  }
  // RAWTEXT less-than sign state
  //------------------------------------------------------------------
  _stateRawtextLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.RAWTEXT_END_TAG_OPEN;
    } else {
      this._emitChars("<", -1);
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // RAWTEXT end tag open state
  //------------------------------------------------------------------
  _stateRawtextEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.RAWTEXT_END_TAG_NAME;
      this._stateRawtextEndTagName(cp);
    } else {
      this._emitChars("</", -1);
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // RAWTEXT end tag name state
  //------------------------------------------------------------------
  _stateRawtextEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</", -1);
      this.state = State.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  // Script data less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataLessThanSign(cp) {
    switch (cp) {
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SCRIPT_DATA_END_TAG_OPEN;
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State.SCRIPT_DATA_ESCAPE_START;
        this._emitChars("<!");
        break;
      }
      default: {
        this._emitChars("<", -1);
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
  }
  // Script data end tag open state
  //------------------------------------------------------------------
  _stateScriptDataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.SCRIPT_DATA_END_TAG_NAME;
      this._stateScriptDataEndTagName(cp);
    } else {
      this._emitChars("</", -1);
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data end tag name state
  //------------------------------------------------------------------
  _stateScriptDataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</", -1);
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escape start state
  //------------------------------------------------------------------
  _stateScriptDataEscapeStart(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.SCRIPT_DATA_ESCAPE_START_DASH;
      this._emitChars("-");
    } else {
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escape start dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapeStartDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
      this._emitChars("-");
    } else {
      this.state = State.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  // Script data escaped state
  //------------------------------------------------------------------
  _stateScriptDataEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped dash dash state
  //------------------------------------------------------------------
  _stateScriptDataEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data escaped less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
    } else if (isAsciiLetter(cp)) {
      this._emitChars("<", -1);
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_START;
      this._stateScriptDataDoubleEscapeStart(cp);
    } else {
      this._emitChars("<", -1);
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data escaped end tag open state
  //------------------------------------------------------------------
  _stateScriptDataEscapedEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_NAME;
      this._stateScriptDataEscapedEndTagName(cp);
    } else {
      this._emitChars("</", -1);
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data escaped end tag name state
  //------------------------------------------------------------------
  _stateScriptDataEscapedEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</", -1);
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data double escape start state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapeStart(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i2 = 0; i2 < SEQUENCES.SCRIPT.length; i2++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  // Script data double escaped state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped dash state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped dash dash state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  // Script data double escaped less-than sign state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_END;
      this._emitChars("/");
    } else {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  // Script data double escape end state
  //------------------------------------------------------------------
  _stateScriptDataDoubleEscapeEnd(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i2 = 0; i2 < SEQUENCES.SCRIPT.length; i2++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State.SCRIPT_DATA_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  // Before attribute name state
  //------------------------------------------------------------------
  _stateBeforeAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this.state = State.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._err(ERR.unexpectedEqualsSignBeforeAttributeName);
        this._createAttr("=");
        this.state = State.ATTRIBUTE_NAME;
        break;
      }
      default: {
        this._createAttr("");
        this.state = State.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  // Attribute name state
  //------------------------------------------------------------------
  _stateAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED:
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this._leaveAttrName();
        this.state = State.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._leaveAttrName();
        this.state = State.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN: {
        this._err(ERR.unexpectedCharacterInAttributeName);
        this.currentAttr.name += String.fromCodePoint(cp);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.name += REPLACEMENT_CHARACTER;
        break;
      }
      default: {
        this.currentAttr.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // After attribute name state
  //------------------------------------------------------------------
  _stateAfterAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this.state = State.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._createAttr("");
        this.state = State.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  // Before attribute value state
  //------------------------------------------------------------------
  _stateBeforeAttributeValue(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingAttributeValue);
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      default: {
        this.state = State.ATTRIBUTE_VALUE_UNQUOTED;
        this._stateAttributeValueUnquoted(cp);
      }
    }
  }
  // Attribute value (double-quoted) state
  //------------------------------------------------------------------
  _stateAttributeValueDoubleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._extendRunWith(REPLACEMENT_CHARACTER, 0);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRun(cp);
      }
    }
  }
  // Attribute value (single-quoted) state
  //------------------------------------------------------------------
  _stateAttributeValueSingleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._extendRunWith(REPLACEMENT_CHARACTER, 0);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRun(cp);
      }
    }
  }
  // Attribute value (unquoted) state
  //------------------------------------------------------------------
  _stateAttributeValueUnquoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._extendRunWith(REPLACEMENT_CHARACTER, 0);
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN:
      case CODE_POINTS.EQUALS_SIGN:
      case CODE_POINTS.GRAVE_ACCENT: {
        this._err(ERR.unexpectedCharacterInUnquotedAttributeValue);
        this._extendRun(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRun(cp);
      }
    }
  }
  // After attribute value (quoted) state
  //------------------------------------------------------------------
  _stateAfterAttributeValueQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this._leaveAttrValue();
        this.state = State.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBetweenAttributes);
        this._leaveAttrValue();
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  // Self-closing start tag state
  //------------------------------------------------------------------
  _stateSelfClosingStartTag(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        const token = this.currentToken;
        token.selfClosing = true;
        this.state = State.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedSolidusInTag);
        this.state = State.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  // Bogus comment state
  //------------------------------------------------------------------
  _stateBogusComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._extendRunWith(REPLACEMENT_CHARACTER, 0);
        break;
      }
      default: {
        this._extendRun(cp);
      }
    }
  }
  // Markup declaration open state
  //------------------------------------------------------------------
  _stateMarkupDeclarationOpen(cp) {
    if (this._consumeSequenceIfMatch(SEQUENCES.DASH_DASH, true)) {
      this._createCommentToken(SEQUENCES.DASH_DASH.length + 1);
      this.state = State.COMMENT_START;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.DOCTYPE, false)) {
      this.currentLocation = this.getCurrentLocation(SEQUENCES.DOCTYPE.length + 1);
      this.state = State.DOCTYPE;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.CDATA_START, true)) {
      if (this.inForeignNode) {
        this.state = State.CDATA_SECTION;
      } else {
        this._err(ERR.cdataInHtmlContent);
        this._createCommentToken(SEQUENCES.CDATA_START.length + 1);
        this.currentToken.data = "[CDATA[";
        this.state = State.BOGUS_COMMENT;
      }
    } else if (!this._ensureHibernation()) {
      this._err(ERR.incorrectlyOpenedComment);
      this._createCommentToken(2);
      this.state = State.BOGUS_COMMENT;
      this._stateBogusComment(cp);
    }
  }
  // Comment start state
  //------------------------------------------------------------------
  _stateCommentStart(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_START_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State.DATA;
        const token = this.currentToken;
        this.emitCurrentComment(token);
        break;
      }
      default: {
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment start dash state
  //------------------------------------------------------------------
  _stateCommentStartDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRunWith("-", -1);
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment state
  //------------------------------------------------------------------
  _stateComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this._extendRunWith("<", 0);
        this.state = State.COMMENT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._extendRunWith(REPLACEMENT_CHARACTER, 0);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRun(cp);
      }
    }
  }
  // Comment less-than sign state
  //------------------------------------------------------------------
  _stateCommentLessThanSign(cp) {
    switch (cp) {
      case CODE_POINTS.EXCLAMATION_MARK: {
        this._extendRunWith("!", 0);
        this.state = State.COMMENT_LESS_THAN_SIGN_BANG;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this._extendRunWith("<", 0);
        break;
      }
      default: {
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment less-than sign bang state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBang(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH;
    } else {
      this.state = State.COMMENT;
      this._stateComment(cp);
    }
  }
  // Comment less-than sign bang dash state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBangDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
    } else {
      this.state = State.COMMENT_END_DASH;
      this._stateCommentEndDash(cp);
    }
  }
  // Comment less-than sign bang dash dash state
  //------------------------------------------------------------------
  _stateCommentLessThanSignBangDashDash(cp) {
    if (cp !== CODE_POINTS.GREATER_THAN_SIGN && cp !== CODE_POINTS.EOF) {
      this._err(ERR.nestedComment);
    }
    this.state = State.COMMENT_END;
    this._stateCommentEnd(cp);
  }
  // Comment end dash state
  //------------------------------------------------------------------
  _stateCommentEndDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State.COMMENT_END;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRunWith("-", -1);
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment end state
  //------------------------------------------------------------------
  _stateCommentEnd(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State.COMMENT_END_BANG;
        break;
      }
      case CODE_POINTS.HYPHEN_MINUS: {
        this._extendRunWith("-", -2);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRunWith("--", -1);
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // Comment end bang state
  //------------------------------------------------------------------
  _stateCommentEndBang(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._extendRunWith("--!", -1);
        this.state = State.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.incorrectlyClosedComment);
        this.state = State.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._extendRunWith("--!", -1);
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  // DOCTYPE state
  //------------------------------------------------------------------
  _stateDoctype(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        this._createDoctypeToken(null);
        const token = this.currentToken;
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBeforeDoctypeName);
        this.state = State.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
      }
    }
  }
  // Before DOCTYPE name state
  //------------------------------------------------------------------
  _stateBeforeDoctypeName(cp) {
    if (isAsciiUpper(cp)) {
      this._createDoctypeToken(String.fromCharCode(toAsciiLower(cp)));
      this.state = State.DOCTYPE_NAME;
    } else
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._createDoctypeToken(REPLACEMENT_CHARACTER);
          this.state = State.DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeName);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._createDoctypeToken(String.fromCodePoint(cp));
          this.state = State.DOCTYPE_NAME;
        }
      }
  }
  // DOCTYPE name state
  //------------------------------------------------------------------
  _stateDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.AFTER_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.name += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  // After DOCTYPE name state
  //------------------------------------------------------------------
  _stateAfterDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        if (this._consumeSequenceIfMatch(SEQUENCES.PUBLIC, false)) {
          this.state = State.AFTER_DOCTYPE_PUBLIC_KEYWORD;
        } else if (this._consumeSequenceIfMatch(SEQUENCES.SYSTEM, false)) {
          this.state = State.AFTER_DOCTYPE_SYSTEM_KEYWORD;
        } else if (!this._ensureHibernation()) {
          this._err(ERR.invalidCharacterSequenceAfterDoctypeName);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
  }
  // After DOCTYPE public keyword state
  //------------------------------------------------------------------
  _stateAfterDoctypePublicKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Before DOCTYPE public identifier state
  //------------------------------------------------------------------
  _stateBeforeDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.publicId = "";
        this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // DOCTYPE public identifier (double-quoted) state
  //------------------------------------------------------------------
  _stateDoctypePublicIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  // DOCTYPE public identifier (single-quoted) state
  //------------------------------------------------------------------
  _stateDoctypePublicIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  // After DOCTYPE public identifier state
  //------------------------------------------------------------------
  _stateAfterDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Between DOCTYPE public and system identifiers state
  //------------------------------------------------------------------
  _stateBetweenDoctypePublicAndSystemIdentifiers(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // After DOCTYPE system keyword state
  //------------------------------------------------------------------
  _stateAfterDoctypeSystemKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Before DOCTYPE system identifier state
  //------------------------------------------------------------------
  _stateBeforeDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // DOCTYPE system identifier (double-quoted) state
  //------------------------------------------------------------------
  _stateDoctypeSystemIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  // DOCTYPE system identifier (single-quoted) state
  //------------------------------------------------------------------
  _stateDoctypeSystemIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  // After DOCTYPE system identifier state
  //------------------------------------------------------------------
  _stateAfterDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedCharacterAfterDoctypeSystemIdentifier);
        this.state = State.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  // Bogus DOCTYPE state
  //------------------------------------------------------------------
  _stateBogusDoctype(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default:
    }
  }
  // CDATA section state
  //------------------------------------------------------------------
  _stateCdataSection(cp) {
    switch (cp) {
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this.state = State.CDATA_SECTION_BRACKET;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInCdata);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  // CDATA section bracket state
  //------------------------------------------------------------------
  _stateCdataSectionBracket(cp) {
    if (cp === CODE_POINTS.RIGHT_SQUARE_BRACKET) {
      this.state = State.CDATA_SECTION_END;
    } else {
      this._emitChars("]", -1);
      this.state = State.CDATA_SECTION;
      this._stateCdataSection(cp);
    }
  }
  // CDATA section end state
  //------------------------------------------------------------------
  _stateCdataSectionEnd(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State.DATA;
        break;
      }
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this._emitChars("]", -2);
        break;
      }
      default: {
        this._emitChars("]]", -1);
        this.state = State.CDATA_SECTION;
        this._stateCdataSection(cp);
      }
    }
  }
  // Character reference state
  //------------------------------------------------------------------
  _stateCharacterReference() {
    let length = this.entityDecoder.write(this.preprocessor.html, this.preprocessor.pos);
    if (length < 0) {
      if (this.preprocessor.lastChunkWritten) {
        length = this.entityDecoder.end();
      } else {
        this.active = false;
        this.preprocessor.pos = this.preprocessor.html.length - 1;
        this.consumedAfterSnapshot = 0;
        this.preprocessor.endOfChunkHit = true;
        return;
      }
    }
    if (length === 0) {
      this.preprocessor.pos = this.entityStartPos;
      this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
      this.state = !this._isCharacterReferenceInAttribute() && isAsciiAlphaNumeric(this.preprocessor.peek(1)) ? State.AMBIGUOUS_AMPERSAND : this.returnState;
    } else {
      this.state = this.returnState;
    }
  }
  // Ambiguos ampersand state
  //------------------------------------------------------------------
  _stateAmbiguousAmpersand(cp) {
    if (isAsciiAlphaNumeric(cp)) {
      this._flushCodePointConsumedAsCharacterReference(cp);
    } else {
      if (cp === CODE_POINTS.SEMICOLON) {
        this._err(ERR.unknownNamedCharacterReference);
      }
      this.state = this.returnState;
      this._callState(cp);
    }
  }
};

// node_modules/parse5/dist/parser/open-element-stack.js
var IMPLICIT_END_TAG_REQUIRED = /* @__PURE__ */ new Set([TAG_ID.DD, TAG_ID.DT, TAG_ID.LI, TAG_ID.OPTGROUP, TAG_ID.OPTION, TAG_ID.P, TAG_ID.RB, TAG_ID.RP, TAG_ID.RT, TAG_ID.RTC]);
var IMPLICIT_END_TAG_REQUIRED_THOROUGHLY = /* @__PURE__ */ new Set([
  ...IMPLICIT_END_TAG_REQUIRED,
  TAG_ID.CAPTION,
  TAG_ID.COLGROUP,
  TAG_ID.TBODY,
  TAG_ID.TD,
  TAG_ID.TFOOT,
  TAG_ID.TH,
  TAG_ID.THEAD,
  TAG_ID.TR
]);
var INDEX_DEPTH = 64;
var SVG_KEYS = 256;
var MATHML_KEYS = 512;
var NAME_KEYS = 768;
var NUMBERED_HEADERS2 = [TAG_ID.H1, TAG_ID.H2, TAG_ID.H3, TAG_ID.H4, TAG_ID.H5, TAG_ID.H6];
var TABLE_BODIES = [TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD];
var TABLE_ROW_CONTEXT = [TAG_ID.TR, TAG_ID.TEMPLATE, TAG_ID.HTML];
var TABLE_BODY_CONTEXT = [...TABLE_BODIES, TAG_ID.TEMPLATE, TAG_ID.HTML];
var TABLE_CONTEXT = [TAG_ID.TABLE, TAG_ID.TEMPLATE, TAG_ID.HTML];
var TABLE_CELLS = [TAG_ID.TD, TAG_ID.TH];
var SPECIAL = 1;
var LIST_ITEM_BOUNDARY = 2;
var SCOPE = 4;
var LIST_ITEM_SCOPE = 8;
var BUTTON_SCOPE = 16;
var TABLE_SCOPE = 32;
var KEY_CLASSES = new Uint8Array(NAME_KEYS);
for (const [ns, offset2] of [
  [NS.HTML, 0],
  [NS.SVG, SVG_KEYS],
  [NS.MATHML, MATHML_KEYS]
]) {
  for (const tn of SPECIAL_ELEMENTS[ns]) {
    KEY_CLASSES[offset2 + tn] = ns === NS.HTML && (tn === TAG_ID.ADDRESS || tn === TAG_ID.DIV || tn === TAG_ID.P) ? SPECIAL : SPECIAL | LIST_ITEM_BOUNDARY;
  }
}
for (const key of [
  TAG_ID.APPLET,
  TAG_ID.CAPTION,
  TAG_ID.HTML,
  TAG_ID.MARQUEE,
  TAG_ID.OBJECT,
  TAG_ID.TABLE,
  TAG_ID.TD,
  TAG_ID.TEMPLATE,
  TAG_ID.TH,
  SVG_KEYS + TAG_ID.DESC,
  SVG_KEYS + TAG_ID.FOREIGN_OBJECT,
  SVG_KEYS + TAG_ID.TITLE,
  MATHML_KEYS + TAG_ID.ANNOTATION_XML,
  MATHML_KEYS + TAG_ID.MI,
  MATHML_KEYS + TAG_ID.MN,
  MATHML_KEYS + TAG_ID.MO,
  MATHML_KEYS + TAG_ID.MS,
  MATHML_KEYS + TAG_ID.MTEXT
]) {
  KEY_CLASSES[key] |= SCOPE | LIST_ITEM_SCOPE | BUTTON_SCOPE;
}
KEY_CLASSES[TAG_ID.OL] |= LIST_ITEM_SCOPE;
KEY_CLASSES[TAG_ID.UL] |= LIST_ITEM_SCOPE;
KEY_CLASSES[TAG_ID.BUTTON] |= BUTTON_SCOPE;
KEY_CLASSES[TAG_ID.TABLE] |= TABLE_SCOPE;
KEY_CLASSES[TAG_ID.HTML] |= TABLE_SCOPE;
var FORMATTING_TAGS = new Uint8Array(NAME_KEYS);
for (const tn of [TAG_ID.A, TAG_ID.B, TAG_ID.BIG, TAG_ID.CODE, TAG_ID.EM, TAG_ID.FONT, TAG_ID.I, TAG_ID.NOBR, TAG_ID.S, TAG_ID.SMALL, TAG_ID.STRIKE, TAG_ID.STRONG, TAG_ID.TT, TAG_ID.U]) {
  FORMATTING_TAGS[tn] = 1;
}
function tagKey(ns, tagID) {
  if (tagID === TAG_ID.UNKNOWN)
    return -1;
  switch (ns) {
    case NS.HTML: {
      return tagID;
    }
    case NS.SVG: {
      return SVG_KEYS + tagID;
    }
    case NS.MATHML: {
      return MATHML_KEYS + tagID;
    }
    default: {
      return -1;
    }
  }
}
var OpenElementStack = class {
  get currentTmplContentOrNode() {
    return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
  }
  constructor(document, treeAdapter, handler) {
    this.treeAdapter = treeAdapter;
    this.handler = handler;
    this.items = [];
    this.tagIDs = [];
    this.stackTop = -1;
    this.depth = 0;
    this.tmplCount = 0;
    this.currentTagId = TAG_ID.UNKNOWN;
    this.indexed = false;
    this.below = [];
    this.above = [];
    this.keys = [];
    this.keyPrev = [];
    this.keyNext = [];
    this.keyTops = new Int32Array(0);
    this.specials = [];
    this.listItemBoundaries = [];
    this.scopeBoundaries = [];
    this.htmlSlots = [];
    this.formattingSlots = /* @__PURE__ */ new Map();
    this.current = document;
  }
  /** The slot of an open element, or -1. */
  _indexOf(element) {
    if (this.indexed) {
      const idx = this.formattingSlots.get(element);
      if (idx !== void 0)
        return idx;
      if (FORMATTING_TAGS[getTagID(this.treeAdapter.getTagName(element))])
        return -1;
    }
    return this.items.lastIndexOf(element, this.stackTop);
  }
  /** The slot of the open element below the one at `idx`, or -1. */
  slotBelow(idx) {
    return this.indexed ? this.below[idx] : idx - 1;
  }
  /** The slot of the open element above the one at `idx`, or -1. */
  slotAbove(idx) {
    if (this.indexed)
      return this.above[idx];
    return idx === this.stackTop ? -1 : idx + 1;
  }
  //Update current element
  _isInTemplate() {
    return this.currentTagId === TAG_ID.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML;
  }
  _updateCurrentElement() {
    this.current = this.items[this.stackTop];
    this.currentTagId = this.tagIDs[this.stackTop];
  }
  //Index
  _nameKey(ns, tagName, create) {
    var _a, _b;
    const name = `${ns} ${tagName}`;
    let key = (_a = this.nameKeys) === null || _a === void 0 ? void 0 : _a.get(name);
    if (key === void 0 && create) {
      (_b = this.nameKeys) !== null && _b !== void 0 ? _b : this.nameKeys = /* @__PURE__ */ new Map();
      key = NAME_KEYS + this.nameKeys.size;
      this.nameKeys.set(name, key);
      if (key === this.keyTops.length) {
        const keyTops = new Int32Array(2 * key).fill(-1);
        keyTops.set(this.keyTops);
        this.keyTops = keyTops;
      }
    }
    return key !== null && key !== void 0 ? key : -1;
  }
  /** Indexes the open elements once the stack is `INDEX_DEPTH` deep. */
  _indexAll() {
    this.indexed = true;
    this.keyTops = new Int32Array(NAME_KEYS).fill(-1);
    for (let i2 = 0; i2 <= this.stackTop; i2++)
      this._index(i2, i2 - 1);
  }
  /** Indexes the element at `slot`, above the open element at `belowIdx`. */
  _index(slot, belowIdx) {
    const element = this.items[slot];
    const tagID = this.tagIDs[slot];
    const ns = this.treeAdapter.getNamespaceURI(element);
    let key = tagKey(ns, tagID);
    if (key === -1)
      key = this._nameKey(ns, this.treeAdapter.getTagName(element), true);
    const keyPrev = this.keyTops[key];
    this.keys[slot] = key;
    this.keyPrev[slot] = keyPrev;
    this.keyNext[slot] = -1;
    if (keyPrev !== -1)
      this.keyNext[keyPrev] = slot;
    this.keyTops[key] = slot;
    this.above[slot] = -1;
    this._link(slot, belowIdx, ns === NS.HTML);
    if (FORMATTING_TAGS[tagID])
      this.formattingSlots.set(element, slot);
  }
  /** Puts the indexed element at `slot` above the one at `belowIdx`, and counts the elements of each class. */
  _link(slot, belowIdx, isHtml) {
    const key = this.keys[slot];
    const classes = key < NAME_KEYS ? KEY_CLASSES[key] : 0;
    this.below[slot] = belowIdx;
    if (belowIdx === -1) {
      this.specials[slot] = classes & SPECIAL;
      this.listItemBoundaries[slot] = (classes & LIST_ITEM_BOUNDARY) >> 1;
      this.scopeBoundaries[slot] = (classes & SCOPE) >> 2;
      this.htmlSlots[slot] = isHtml ? slot : -1;
    } else {
      this.above[belowIdx] = slot;
      this.specials[slot] = this.specials[belowIdx] + (classes & SPECIAL);
      this.listItemBoundaries[slot] = this.listItemBoundaries[belowIdx] + ((classes & LIST_ITEM_BOUNDARY) >> 1);
      this.scopeBoundaries[slot] = this.scopeBoundaries[belowIdx] + ((classes & SCOPE) >> 2);
      this.htmlSlots[slot] = isHtml ? slot : this.htmlSlots[belowIdx];
    }
  }
  /** Takes the element at `slot` out of the index, except for the links between slots. */
  _unindex(slot) {
    const key = this.keys[slot];
    const keyPrev = this.keyPrev[slot];
    const keyNext = this.keyNext[slot];
    if (keyPrev !== -1)
      this.keyNext[keyPrev] = keyNext;
    if (keyNext === -1)
      this.keyTops[key] = keyPrev;
    else
      this.keyPrev[keyNext] = keyPrev;
    if (FORMATTING_TAGS[this.tagIDs[slot]])
      this.formattingSlots.delete(this.items[slot]);
  }
  /** Moves the indexed element at `from` down to the free slot `to`, keeping its key chain in order. */
  _move(from, to) {
    const element = this.items[from];
    const key = this.keys[from];
    const keyPrev = this.keyPrev[from];
    const keyNext = this.keyNext[from];
    this.items[to] = element;
    this.tagIDs[to] = this.tagIDs[from];
    this.keys[to] = key;
    this.keyPrev[to] = keyPrev;
    this.keyNext[to] = keyNext;
    if (keyPrev !== -1)
      this.keyNext[keyPrev] = to;
    if (keyNext === -1)
      this.keyTops[key] = to;
    else
      this.keyPrev[keyNext] = to;
    if (FORMATTING_TAGS[this.tagIDs[to]])
      this.formattingSlots.set(element, to);
  }
  //Search by tag
  /** The slot of the topmost open HTML element with this tag, or -1. */
  indexOfTopmost(tagID) {
    if (this.indexed)
      return this.keyTops[tagID];
    for (let i2 = this.stackTop; i2 >= 0; i2--) {
      if (this.tagIDs[i2] === tagID && this.treeAdapter.getNamespaceURI(this.items[i2]) === NS.HTML)
        return i2;
    }
    return -1;
  }
  /** The slot of the topmost open HTML element with any of these tags, or -1. */
  indexOfTopmostOf(tagIDs) {
    if (this.indexed) {
      let top = -1;
      for (const tagID of tagIDs) {
        if (this.keyTops[tagID] > top)
          top = this.keyTops[tagID];
      }
      return top;
    }
    for (let i2 = this.stackTop; i2 >= 0; i2--) {
      if (tagIDs.includes(this.tagIDs[i2]) && this.treeAdapter.getNamespaceURI(this.items[i2]) === NS.HTML)
        return i2;
    }
    return -1;
  }
  /** The slot of the topmost open element in this namespace with this tag name, or -1. */
  indexOfTopmostByName(ns, tagName) {
    if (this.indexed) {
      let key = tagKey(ns, getTagID(tagName));
      if (key === -1)
        key = this._nameKey(ns, tagName, false);
      return key === -1 ? -1 : this.keyTops[key];
    }
    for (let i2 = this.stackTop; i2 >= 0; i2--) {
      const element = this.items[i2];
      if (this.treeAdapter.getTagName(element) === tagName && this.treeAdapter.getNamespaceURI(element) === ns) {
        return i2;
      }
    }
    return -1;
  }
  /** The slot of the topmost open HTML element, or -1. */
  indexOfTopmostHtmlElement() {
    if (this.indexed)
      return this.stackTop === -1 ? -1 : this.htmlSlots[this.stackTop];
    let i2 = this.stackTop;
    while (i2 >= 0 && this.treeAdapter.getNamespaceURI(this.items[i2]) !== NS.HTML)
      i2--;
    return i2;
  }
  /** Whether an element of the classes is open above the slot `idx`, on a stack that is not indexed. */
  _hasAbove(idx, classes) {
    for (let i2 = this.stackTop; i2 > idx; i2--) {
      const key = tagKey(this.treeAdapter.getNamespaceURI(this.items[i2]), this.tagIDs[i2]);
      if (key !== -1 && KEY_CLASSES[key] & classes)
        return true;
    }
    return false;
  }
  /** Whether a special element is open above the slot `idx`. */
  hasSpecialElementAbove(idx) {
    return this.indexed ? this.specials[this.stackTop] !== this.specials[idx] : this._hasAbove(idx, SPECIAL);
  }
  /** Whether a special element other than HTML `address`, `div` and `p` is open above the slot `idx`. */
  hasListItemBoundaryAbove(idx) {
    return this.indexed ? this.listItemBoundaries[this.stackTop] !== this.listItemBoundaries[idx] : this._hasAbove(idx, LIST_ITEM_BOUNDARY);
  }
  //Mutations
  push(element, tagID) {
    const belowIdx = this.stackTop;
    this.stackTop++;
    this.depth++;
    this.items[this.stackTop] = element;
    this.current = element;
    this.tagIDs[this.stackTop] = tagID;
    this.currentTagId = tagID;
    if (this.indexed)
      this._index(this.stackTop, belowIdx);
    else if (this.depth === INDEX_DEPTH)
      this._indexAll();
    if (this._isInTemplate()) {
      this.tmplCount++;
    }
    this.handler.onItemPush(element, tagID, true);
  }
  /** Pops the current element without calling the handler. */
  _popCurrent() {
    if (this.tmplCount > 0 && this._isInTemplate()) {
      this.tmplCount--;
    }
    if (this.indexed) {
      this._unindex(this.stackTop);
      this.stackTop = this.below[this.stackTop];
      if (this.stackTop !== -1)
        this.above[this.stackTop] = -1;
    } else {
      this.stackTop--;
    }
    this.depth--;
    this._updateCurrentElement();
  }
  pop() {
    const popped = this.current;
    this._popCurrent();
    this.handler.onItemPop(popped, true);
  }
  replace(oldElement, newElement) {
    const idx = this._indexOf(oldElement);
    this.items[idx] = newElement;
    if (this.indexed && FORMATTING_TAGS[this.tagIDs[idx]]) {
      this.formattingSlots.delete(oldElement);
      this.formattingSlots.set(newElement, idx);
    }
    if (idx === this.stackTop) {
      this.current = newElement;
    }
  }
  /**
   * The adoption agency's last stack step: removes the formatting element at `formattingIdx` and opens `element`
   * directly above the furthest block at `furthestBlockIdx`. On an indexed stack, only formatting elements the agency
   * kept are still open between them; the furthest block, with those directly below it, moves down by one slot, and
   * `element` takes the furthest block's slot. No open element above the furthest block moves, and as all these
   * elements are HTML elements and only the furthest block is special, the counts above it stay the same.
   */
  replaceFormattingElement(formattingIdx, furthestBlockIdx, element, tagID) {
    const formattingElement = this.items[formattingIdx];
    if (!this.indexed) {
      this.items.splice(formattingIdx, 1);
      this.tagIDs.splice(formattingIdx, 1);
      this.handler.onItemPop(formattingElement, false);
      this.items.splice(furthestBlockIdx, 0, element);
      this.tagIDs.splice(furthestBlockIdx, 0, tagID);
      if (furthestBlockIdx === this.stackTop)
        this._updateCurrentElement();
      if (this.current && this.currentTagId !== void 0) {
        this.handler.onItemPush(this.current, this.currentTagId, furthestBlockIdx === this.stackTop);
      }
      return;
    }
    const key = this.keys[formattingIdx];
    const belowIdx = this.below[formattingIdx];
    const aboveIdx = this.above[furthestBlockIdx];
    const kept = [];
    for (let i2 = this.above[formattingIdx]; i2 !== furthestBlockIdx; i2 = this.above[i2])
      kept.push(i2);
    const keyNext = this.keyNext[formattingIdx];
    this._unindex(formattingIdx);
    this.items[formattingIdx] = void 0;
    this.handler.onItemPop(formattingElement, false);
    let free = furthestBlockIdx - 1;
    while (kept.length > 0 && kept[kept.length - 1] === free) {
      kept.pop();
      free--;
    }
    for (let i2 = free + 1; i2 <= furthestBlockIdx; i2++)
      this._move(i2, i2 - 1);
    const keyPrev = keyNext === -1 ? this.keyTops[key] : this.keyPrev[keyNext];
    this.items[furthestBlockIdx] = element;
    this.tagIDs[furthestBlockIdx] = tagID;
    this.keys[furthestBlockIdx] = key;
    this.keyPrev[furthestBlockIdx] = keyPrev;
    this.keyNext[furthestBlockIdx] = keyNext;
    if (keyPrev !== -1)
      this.keyNext[keyPrev] = furthestBlockIdx;
    if (keyNext === -1)
      this.keyTops[key] = furthestBlockIdx;
    else
      this.keyPrev[keyNext] = furthestBlockIdx;
    if (FORMATTING_TAGS[tagID])
      this.formattingSlots.set(element, furthestBlockIdx);
    let prev = belowIdx;
    for (const i2 of kept) {
      this._link(i2, prev, true);
      prev = i2;
    }
    for (let i2 = free; i2 < furthestBlockIdx; i2++) {
      this._link(i2, prev, true);
      prev = i2;
    }
    this._link(furthestBlockIdx, prev, true);
    if (aboveIdx === -1)
      this._updateCurrentElement();
    if (this.current && this.currentTagId !== void 0) {
      this.handler.onItemPush(this.current, this.currentTagId, aboveIdx === -1);
    }
  }
  popUntilTagNamePopped(tagName) {
    this.shortenToLength(Math.max(this.indexOfTopmost(tagName), 0));
  }
  shortenToLength(idx) {
    while (this.stackTop >= idx) {
      const popped = this.current;
      this._popCurrent();
      this.handler.onItemPop(popped, this.stackTop < idx);
    }
  }
  popUntilElementPopped(element) {
    const idx = this._indexOf(element);
    this.shortenToLength(Math.max(idx, 0));
  }
  popUntilNumberedHeaderPopped() {
    this.shortenToLength(Math.max(this.indexOfTopmostOf(NUMBERED_HEADERS2), 0));
  }
  popUntilTableCellPopped() {
    this.shortenToLength(Math.max(this.indexOfTopmostOf(TABLE_CELLS), 0));
  }
  popAllUpToHtmlElement() {
    this.tmplCount = 0;
    this.shortenToLength(1);
  }
  clearBackToTableContext() {
    this.shortenToLength(this.indexOfTopmostOf(TABLE_CONTEXT) + 1);
  }
  clearBackToTableBodyContext() {
    this.shortenToLength(this.indexOfTopmostOf(TABLE_BODY_CONTEXT) + 1);
  }
  clearBackToTableRowContext() {
    this.shortenToLength(this.indexOfTopmostOf(TABLE_ROW_CONTEXT) + 1);
  }
  remove(element) {
    const idx = this._indexOf(element);
    if (idx !== -1)
      this.removeAt(idx);
  }
  /** Removes the open element at the slot `idx`; on an indexed stack, the elements above it keep their slots. */
  removeAt(idx) {
    if (idx === this.stackTop) {
      this.pop();
      return;
    }
    const element = this.items[idx];
    this.depth--;
    if (this.indexed) {
      const classes = this.keys[idx] < NAME_KEYS ? KEY_CLASSES[this.keys[idx]] : 0;
      const belowIdx = this.below[idx];
      const aboveIdx = this.above[idx];
      this._unindex(idx);
      this.items[idx] = void 0;
      this.below[aboveIdx] = belowIdx;
      if (belowIdx !== -1)
        this.above[belowIdx] = aboveIdx;
      if (classes !== 0) {
        for (let i2 = aboveIdx; i2 !== -1; i2 = this.above[i2]) {
          this.specials[i2] -= classes & SPECIAL;
          this.listItemBoundaries[i2] -= (classes & LIST_ITEM_BOUNDARY) >> 1;
          this.scopeBoundaries[i2] -= (classes & SCOPE) >> 2;
        }
      }
      const html = belowIdx === -1 ? -1 : this.htmlSlots[belowIdx];
      for (let i2 = aboveIdx; i2 !== -1 && this.htmlSlots[i2] === idx; i2 = this.above[i2]) {
        this.htmlSlots[i2] = html;
      }
    } else {
      this.items.splice(idx, 1);
      this.tagIDs.splice(idx, 1);
      this.stackTop--;
      this._updateCurrentElement();
    }
    this.handler.onItemPop(element, false);
  }
  //Search
  tryPeekProperlyNestedBodyElement() {
    return this.stackTop >= 1 && this.tagIDs[1] === TAG_ID.BODY ? this.items[1] : null;
  }
  contains(element) {
    return this._indexOf(element) > -1;
  }
  getCommonAncestor(element) {
    const idx = this._indexOf(element);
    const belowIdx = idx === -1 ? -1 : this.slotBelow(idx);
    return belowIdx === -1 ? null : this.items[belowIdx];
  }
  isRootHtmlElementCurrent() {
    return this.stackTop === 0 && this.tagIDs[0] === TAG_ID.HTML;
  }
  //Element in scope
  /**
   * On an indexed stack: whether no element of the `scope` class is open above the slot `target`. A target that is not
   * open is in scope only on a stack without such an element, as a scan from the top would end there.
   */
  _isInScope(target, scope) {
    let boundary = -1;
    switch (scope) {
      case LIST_ITEM_SCOPE: {
        boundary = Math.max(this.keyTops[TAG_ID.OL], this.keyTops[TAG_ID.UL]);
        break;
      }
      case BUTTON_SCOPE: {
        boundary = this.keyTops[TAG_ID.BUTTON];
        break;
      }
      case TABLE_SCOPE: {
        boundary = Math.max(this.keyTops[TAG_ID.TABLE], this.keyTops[TAG_ID.HTML]);
        return target === -1 ? boundary === -1 : target >= boundary;
      }
      default:
    }
    return target === -1 ? boundary === -1 && (this.stackTop === -1 || this.scopeBoundaries[this.stackTop] === 0) : target >= boundary && this.scopeBoundaries[this.stackTop] === this.scopeBoundaries[target];
  }
  /**
   * On a stack that is not indexed: whether an HTML element with the tag, or one of the tags, and if passed the element
   * itself, is open above every element of the `scope` class; true if neither is open.
   */
  _scanScope(tagID, tagIDs, scope, element) {
    for (let i2 = this.stackTop; i2 >= 0; i2--) {
      const key = tagKey(this.treeAdapter.getNamespaceURI(this.items[i2]), this.tagIDs[i2]);
      if (key === -1)
        continue;
      if ((tagIDs ? tagIDs.includes(key) : key === tagID) && (!element || this.items[i2] === element))
        return true;
      if (KEY_CLASSES[key] & scope)
        return false;
    }
    return true;
  }
  /** If `element` is passed, only that element (which has to be a `tagName` element) is looked for. */
  hasInScope(tagName, element) {
    if (!this.indexed)
      return this._scanScope(tagName, null, SCOPE, element);
    return this._isInScope(element ? this._indexOf(element) : this.keyTops[tagName], SCOPE);
  }
  hasInListItemScope(tagName) {
    return this.indexed ? this._isInScope(this.keyTops[tagName], LIST_ITEM_SCOPE) : this._scanScope(tagName, null, LIST_ITEM_SCOPE);
  }
  hasInButtonScope(tagName) {
    return this.indexed ? this._isInScope(this.keyTops[tagName], BUTTON_SCOPE) : this._scanScope(tagName, null, BUTTON_SCOPE);
  }
  hasNumberedHeaderInScope() {
    return this.indexed ? this._isInScope(this.indexOfTopmostOf(NUMBERED_HEADERS2), SCOPE) : this._scanScope(TAG_ID.UNKNOWN, NUMBERED_HEADERS2, SCOPE);
  }
  hasInTableScope(tagName) {
    return this.indexed ? this._isInScope(this.keyTops[tagName], TABLE_SCOPE) : this._scanScope(tagName, null, TABLE_SCOPE);
  }
  hasTableBodyContextInTableScope() {
    return this.indexed ? this._isInScope(this.indexOfTopmostOf(TABLE_BODIES), TABLE_SCOPE) : this._scanScope(TAG_ID.UNKNOWN, TABLE_BODIES, TABLE_SCOPE);
  }
  hasInSelectScope(tagName) {
    for (let i2 = this.stackTop; i2 >= 0; i2 = this.slotBelow(i2)) {
      if (this.treeAdapter.getNamespaceURI(this.items[i2]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i2]) {
        case tagName: {
          return true;
        }
        case TAG_ID.OPTION:
        case TAG_ID.OPTGROUP: {
          break;
        }
        default: {
          return false;
        }
      }
    }
    return true;
  }
  //Implied end tags
  generateImpliedEndTags() {
    while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED.has(this.currentTagId) && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML) {
      this.pop();
    }
  }
  generateImpliedEndTagsThoroughly() {
    while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId) && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML) {
      this.pop();
    }
  }
  generateImpliedEndTagsWithExclusion(exclusionId) {
    while (this.currentTagId !== void 0 && this.currentTagId !== exclusionId && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId) && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML) {
      this.pop();
    }
  }
};

// node_modules/parse5/dist/parser/formatting-element-list.js
var NOAH_ARK_CAPACITY = 3;
var EntryType;
(function(EntryType2) {
  EntryType2[EntryType2["Marker"] = 0] = "Marker";
  EntryType2[EntryType2["Element"] = 1] = "Element";
})(EntryType || (EntryType = {}));
var FormattingElementList = class {
  constructor() {
    this.newest = null;
    this.bookmark = null;
    this.index = null;
    this.elementEntries = /* @__PURE__ */ new Map();
  }
  /** Returns the entry's ark, or null if the entries after the last marker are not indexed. */
  _insertElementEntry(element, token, older) {
    const newer = older === null ? null : older.newer;
    const entry = {
      type: EntryType.Element,
      element,
      token,
      older,
      newer,
      ark: null,
      olderSameTag: null,
      newerSameTag: null
    };
    if (newer === null) {
      this.newest = entry;
    } else {
      newer.older = entry;
    }
    if (older !== null) {
      older.newer = entry;
    }
    return this.index === null ? null : this._addToIndex(this.index, entry);
  }
  _addToIndex(index, entry) {
    const { tagName, attrs } = entry.token;
    const key = tagName + attrs.map(({ name, value }) => `\0${name}\0${value}`).sort().join("");
    let ark = index.arks.get(key);
    if (ark === void 0) {
      ark = { entries: [], key };
      index.arks.set(key, ark);
    }
    ark.entries.push(entry);
    entry.ark = ark;
    this.elementEntries.set(entry.element, entry);
    let head = index.tagNames.get(tagName);
    if (head === void 0) {
      head = { olderSameTag: null };
      index.tagNames.set(tagName, head);
    }
    entry.olderSameTag = head.olderSameTag;
    entry.newerSameTag = head;
    if (head.olderSameTag !== null) {
      head.olderSameTag.newerSameTag = entry;
    }
    head.olderSameTag = entry;
    return ark;
  }
  //Mutations
  insertMarker() {
    if (this.index === null) {
      for (let entry = this.newest; entry !== null && entry.type === EntryType.Element; entry = entry.older) {
        this.elementEntries.set(entry.element, entry);
      }
    }
    const marker = {
      type: EntryType.Marker,
      older: this.newest,
      newer: null,
      outerIndex: this.index
    };
    if (this.newest !== null) {
      this.newest.newer = marker;
    }
    this.newest = marker;
    this.index = null;
  }
  pushElement(element, token) {
    if (this.index === null) {
      let oldest = null;
      let count = 0;
      for (let entry = this.newest; entry !== null && entry.type === EntryType.Element; entry = entry.older) {
        oldest = entry;
        count++;
      }
      if (count >= NOAH_ARK_CAPACITY) {
        this.index = { arks: /* @__PURE__ */ new Map(), tagNames: /* @__PURE__ */ new Map() };
        for (let entry = oldest; entry !== null && entry.type === EntryType.Element; entry = entry.newer) {
          this._addToIndex(this.index, entry);
        }
      }
    }
    const ark = this._insertElementEntry(element, token, this.newest);
    if (ark !== null && ark.entries.length > NOAH_ARK_CAPACITY) {
      this.removeEntry(ark.entries[0]);
    }
  }
  insertElementAfterBookmark(element, token) {
    const { bookmark } = this;
    this.bookmark = null;
    this._insertElementEntry(element, token, bookmark);
  }
  removeEntry(entry) {
    var _a;
    if (entry.newer === null ? this.newest !== entry : entry.newer.older !== entry) {
      return;
    }
    this.elementEntries.delete(entry.element);
    if (entry.newer === null) {
      this.newest = entry.older;
    } else {
      entry.newer.older = entry.older;
    }
    if (entry.older !== null) {
      entry.older.newer = entry.newer;
    }
    if (entry.ark !== null) {
      const { entries, key } = entry.ark;
      entries.splice(entries.indexOf(entry), 1);
      if (entries.length === 0)
        (_a = this.index) === null || _a === void 0 ? void 0 : _a.arks.delete(key);
    }
    if (entry.newerSameTag !== null) {
      entry.newerSameTag.olderSameTag = entry.olderSameTag;
      if (entry.olderSameTag !== null) {
        entry.olderSameTag.newerSameTag = entry.newerSameTag;
      }
    }
  }
  replaceElement(entry, element) {
    if (this.elementEntries.delete(entry.element)) {
      this.elementEntries.set(element, entry);
    }
    entry.element = element;
  }
  /**
   * Clears the list of formatting elements up to the last marker.
   *
   * @see https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker
   */
  clearToLastMarker() {
    let marker = this.newest;
    for (; marker !== null && marker.type === EntryType.Element; marker = marker.older) {
      this.elementEntries.delete(marker.element);
    }
    this.newest = marker === null ? null : marker.older;
    this.index = marker === null ? null : marker.outerIndex;
    if (this.newest !== null) {
      this.newest.newer = null;
    }
  }
  //Search
  getElementEntryInScopeWithTagName(tagName) {
    var _a, _b;
    if (this.index !== null) {
      return (_b = (_a = this.index.tagNames.get(tagName)) === null || _a === void 0 ? void 0 : _a.olderSameTag) !== null && _b !== void 0 ? _b : null;
    }
    for (let entry = this.newest; entry !== null && entry.type === EntryType.Element; entry = entry.older) {
      if (entry.token.tagName === tagName) {
        return entry;
      }
    }
    return null;
  }
  getElementEntry(element) {
    if (this.index === null) {
      for (let entry = this.newest; entry !== null && entry.type === EntryType.Element; entry = entry.older) {
        if (entry.element === element) {
          return entry;
        }
      }
    }
    return this.elementEntries.get(element);
  }
};

// node_modules/parse5/dist/tree-adapters/default.js
var attrListIndexes = /* @__PURE__ */ new WeakMap();
var defaultTreeAdapter = {
  //Node construction
  createDocument() {
    return {
      nodeName: "#document",
      mode: DOCUMENT_MODE.NO_QUIRKS,
      childNodes: []
    };
  },
  createDocumentFragment() {
    return {
      nodeName: "#document-fragment",
      childNodes: []
    };
  },
  createElement(tagName, namespaceURI, attrs) {
    return {
      nodeName: tagName,
      tagName,
      attrs,
      namespaceURI,
      childNodes: [],
      parentNode: null
    };
  },
  createCommentNode(data2) {
    return {
      nodeName: "#comment",
      data: data2,
      parentNode: null
    };
  },
  createTextNode(value) {
    return {
      nodeName: "#text",
      value,
      parentNode: null
    };
  },
  //Tree mutation
  appendChild(parentNode, newNode) {
    parentNode.childNodes.push(newNode);
    newNode.parentNode = parentNode;
  },
  insertBefore(parentNode, newNode, referenceNode) {
    const { childNodes } = parentNode;
    const insertionIdx = childNodes[childNodes.length - 1] === referenceNode ? childNodes.length - 1 : childNodes.indexOf(referenceNode);
    childNodes.splice(insertionIdx, 0, newNode);
    newNode.parentNode = parentNode;
  },
  setTemplateContent(templateElement, contentElement) {
    templateElement.content = contentElement;
  },
  getTemplateContent(templateElement) {
    return templateElement.content;
  },
  setDocumentType(document, name, publicId, systemId) {
    const doctypeNode = document.childNodes.find((node) => node.nodeName === "#documentType");
    if (doctypeNode) {
      doctypeNode.name = name;
      doctypeNode.publicId = publicId;
      doctypeNode.systemId = systemId;
    } else {
      const node = {
        nodeName: "#documentType",
        name,
        publicId,
        systemId,
        parentNode: null
      };
      defaultTreeAdapter.appendChild(document, node);
    }
  },
  setDocumentMode(document, mode) {
    document.mode = mode;
  },
  getDocumentMode(document) {
    return document.mode;
  },
  detachNode(node) {
    if (node.parentNode) {
      const { childNodes } = node.parentNode;
      const idx = childNodes[childNodes.length - 1] === node ? childNodes.length - 1 : childNodes.indexOf(node);
      childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  },
  insertText(parentNode, text) {
    if (parentNode.childNodes.length > 0) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];
      if (defaultTreeAdapter.isTextNode(prevNode)) {
        prevNode.value += text;
        return;
      }
    }
    defaultTreeAdapter.appendChild(parentNode, defaultTreeAdapter.createTextNode(text));
  },
  insertTextBefore(parentNode, text, referenceNode) {
    const { childNodes } = parentNode;
    const referenceIdx = childNodes[childNodes.length - 1] === referenceNode ? childNodes.length - 1 : childNodes.indexOf(referenceNode);
    const prevNode = childNodes[referenceIdx - 1];
    if (prevNode && defaultTreeAdapter.isTextNode(prevNode)) {
      prevNode.value += text;
    } else {
      defaultTreeAdapter.insertBefore(parentNode, defaultTreeAdapter.createTextNode(text), referenceNode);
    }
  },
  /**
   * Keeps the recipient's names between merges as a map from name to position. The map is rebuilt when the list changed
   * length or has a repeated name, or when a merged name it holds no longer names the entry at that position. A name that
   * other code gives an existing entry between two merges is missed otherwise, and merging it appends it a second time.
   */
  adoptAttributes(recipient, attrs) {
    if (attrs.length === 0 || attrs === recipient.attrs)
      return;
    const cached = attrListIndexes.get(recipient.attrs);
    const isIndexed = (cached === null || cached === void 0 ? void 0 : cached.size) === recipient.attrs.length && attrs.every(({ name }) => {
      var _a;
      const index = cached.get(name);
      return index === void 0 || ((_a = recipient.attrs[index]) === null || _a === void 0 ? void 0 : _a.name) === name;
    });
    const recipientAttrsMap = isIndexed ? cached : /* @__PURE__ */ new Map();
    if (!isIndexed) {
      for (let i2 = 0; i2 < recipient.attrs.length; i2++) {
        const attr = recipient.attrs[i2];
        if (attr !== void 0)
          recipientAttrsMap.set(attr.name, i2);
      }
      attrListIndexes.set(recipient.attrs, recipientAttrsMap);
    }
    const adoptedFrom = recipient.attrs.length;
    for (let j = 0; j < attrs.length; j++) {
      if (!recipientAttrsMap.has(attrs[j].name)) {
        recipient.attrs.push(attrs[j]);
      }
    }
    for (let j = adoptedFrom; j < recipient.attrs.length; j++) {
      recipientAttrsMap.set(recipient.attrs[j].name, j);
    }
    if (recipientAttrsMap.size !== recipient.attrs.length) {
      attrListIndexes.delete(recipient.attrs);
    }
  },
  //Tree traversing
  getFirstChild(node) {
    return node.childNodes[0];
  },
  getChildNodes(node) {
    return node.childNodes;
  },
  getParentNode(node) {
    return node.parentNode;
  },
  getAttrList(element) {
    return element.attrs;
  },
  //Node data
  getTagName(element) {
    return element.tagName;
  },
  getNamespaceURI(element) {
    return element.namespaceURI;
  },
  getTextNodeContent(textNode) {
    return textNode.value;
  },
  getCommentNodeContent(commentNode) {
    return commentNode.data;
  },
  getDocumentTypeNodeName(doctypeNode) {
    return doctypeNode.name;
  },
  getDocumentTypeNodePublicId(doctypeNode) {
    return doctypeNode.publicId;
  },
  getDocumentTypeNodeSystemId(doctypeNode) {
    return doctypeNode.systemId;
  },
  //Node types
  isTextNode(node) {
    return node.nodeName === "#text";
  },
  isCommentNode(node) {
    return node.nodeName === "#comment";
  },
  isDocumentTypeNode(node) {
    return node.nodeName === "#documentType";
  },
  isElementNode(node) {
    return Object.prototype.hasOwnProperty.call(node, "tagName");
  },
  // Source code location
  setNodeSourceCodeLocation(node, location) {
    node.sourceCodeLocation = location;
  },
  getNodeSourceCodeLocation(node) {
    return node.sourceCodeLocation;
  },
  updateNodeSourceCodeLocation(node, endLocation) {
    node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
  }
};

// node_modules/parse5/dist/common/doctype.js
var VALID_DOCTYPE_NAME = "html";
var VALID_SYSTEM_ID = "about:legacy-compat";
var QUIRKS_MODE_SYSTEM_ID = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
var QUIRKS_MODE_PUBLIC_ID_PREFIXES = [
  "+//silmaril//dtd html pro v0r11 19970101//",
  "-//as//dtd html 3.0 aswedit + extensions//",
  "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
  "-//ietf//dtd html 2.0 level 1//",
  "-//ietf//dtd html 2.0 level 2//",
  "-//ietf//dtd html 2.0 strict level 1//",
  "-//ietf//dtd html 2.0 strict level 2//",
  "-//ietf//dtd html 2.0 strict//",
  "-//ietf//dtd html 2.0//",
  "-//ietf//dtd html 2.1e//",
  "-//ietf//dtd html 3.0//",
  "-//ietf//dtd html 3.2 final//",
  "-//ietf//dtd html 3.2//",
  "-//ietf//dtd html 3//",
  "-//ietf//dtd html level 0//",
  "-//ietf//dtd html level 1//",
  "-//ietf//dtd html level 2//",
  "-//ietf//dtd html level 3//",
  "-//ietf//dtd html strict level 0//",
  "-//ietf//dtd html strict level 1//",
  "-//ietf//dtd html strict level 2//",
  "-//ietf//dtd html strict level 3//",
  "-//ietf//dtd html strict//",
  "-//ietf//dtd html//",
  "-//metrius//dtd metrius presentational//",
  "-//microsoft//dtd internet explorer 2.0 html strict//",
  "-//microsoft//dtd internet explorer 2.0 html//",
  "-//microsoft//dtd internet explorer 2.0 tables//",
  "-//microsoft//dtd internet explorer 3.0 html strict//",
  "-//microsoft//dtd internet explorer 3.0 html//",
  "-//microsoft//dtd internet explorer 3.0 tables//",
  "-//netscape comm. corp.//dtd html//",
  "-//netscape comm. corp.//dtd strict html//",
  "-//o'reilly and associates//dtd html 2.0//",
  "-//o'reilly and associates//dtd html extended 1.0//",
  "-//o'reilly and associates//dtd html extended relaxed 1.0//",
  "-//sq//dtd html 2.0 hotmetal + extensions//",
  "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
  "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
  "-//spyglass//dtd html 2.0 extended//",
  "-//sun microsystems corp.//dtd hotjava html//",
  "-//sun microsystems corp.//dtd hotjava strict html//",
  "-//w3c//dtd html 3 1995-03-24//",
  "-//w3c//dtd html 3.2 draft//",
  "-//w3c//dtd html 3.2 final//",
  "-//w3c//dtd html 3.2//",
  "-//w3c//dtd html 3.2s draft//",
  "-//w3c//dtd html 4.0 frameset//",
  "-//w3c//dtd html 4.0 transitional//",
  "-//w3c//dtd html experimental 19960712//",
  "-//w3c//dtd html experimental 970421//",
  "-//w3c//dtd w3 html//",
  "-//w3o//dtd w3 html 3.0//",
  "-//webtechs//dtd mozilla html 2.0//",
  "-//webtechs//dtd mozilla html//"
];
var QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...QUIRKS_MODE_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
var QUIRKS_MODE_PUBLIC_IDS = /* @__PURE__ */ new Set([
  "-//w3o//dtd w3 html strict 3.0//en//",
  "-/w3c/dtd html 4.0 transitional/en",
  "html"
]);
var LIMITED_QUIRKS_PUBLIC_ID_PREFIXES = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"];
var LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...LIMITED_QUIRKS_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
function hasPrefix(publicId, prefixes) {
  return prefixes.some((prefix) => publicId.startsWith(prefix));
}
function isConforming(token) {
  return token.name === VALID_DOCTYPE_NAME && token.publicId === null && (token.systemId === null || token.systemId === VALID_SYSTEM_ID);
}
function getDocumentMode(token) {
  if (token.name !== VALID_DOCTYPE_NAME) {
    return DOCUMENT_MODE.QUIRKS;
  }
  const { systemId } = token;
  if (systemId && systemId.toLowerCase() === QUIRKS_MODE_SYSTEM_ID) {
    return DOCUMENT_MODE.QUIRKS;
  }
  let { publicId } = token;
  if (publicId !== null) {
    publicId = publicId.toLowerCase();
    if (QUIRKS_MODE_PUBLIC_IDS.has(publicId)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    let prefixes = systemId === null ? QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES : QUIRKS_MODE_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    prefixes = systemId === null ? LIMITED_QUIRKS_PUBLIC_ID_PREFIXES : LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.LIMITED_QUIRKS;
    }
  }
  return DOCUMENT_MODE.NO_QUIRKS;
}

// node_modules/parse5/dist/common/foreign-content.js
var MIME_TYPES = {
  TEXT_HTML: "text/html",
  APPLICATION_XML: "application/xhtml+xml"
};
var DEFINITION_URL_ATTR = "definitionurl";
var ADJUSTED_DEFINITION_URL_ATTR = "definitionURL";
var SVG_ATTRS_ADJUSTMENT_MAP = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map((attr) => [attr.toLowerCase(), attr]));
var XML_ATTRS_ADJUSTMENT_MAP = /* @__PURE__ */ new Map([
  ["xlink:actuate", { prefix: "xlink", name: "actuate", namespace: NS.XLINK }],
  ["xlink:arcrole", { prefix: "xlink", name: "arcrole", namespace: NS.XLINK }],
  ["xlink:href", { prefix: "xlink", name: "href", namespace: NS.XLINK }],
  ["xlink:role", { prefix: "xlink", name: "role", namespace: NS.XLINK }],
  ["xlink:show", { prefix: "xlink", name: "show", namespace: NS.XLINK }],
  ["xlink:title", { prefix: "xlink", name: "title", namespace: NS.XLINK }],
  ["xlink:type", { prefix: "xlink", name: "type", namespace: NS.XLINK }],
  ["xml:lang", { prefix: "xml", name: "lang", namespace: NS.XML }],
  ["xml:space", { prefix: "xml", name: "space", namespace: NS.XML }],
  ["xmlns", { prefix: "", name: "xmlns", namespace: NS.XMLNS }],
  ["xmlns:xlink", { prefix: "xmlns", name: "xlink", namespace: NS.XMLNS }]
]);
var SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "textPath"
].map((tn) => [tn.toLowerCase(), tn]));
var EXITS_FOREIGN_CONTENT = /* @__PURE__ */ new Set([
  TAG_ID.B,
  TAG_ID.BIG,
  TAG_ID.BLOCKQUOTE,
  TAG_ID.BODY,
  TAG_ID.BR,
  TAG_ID.CENTER,
  TAG_ID.CODE,
  TAG_ID.DD,
  TAG_ID.DIV,
  TAG_ID.DL,
  TAG_ID.DT,
  TAG_ID.EM,
  TAG_ID.EMBED,
  TAG_ID.H1,
  TAG_ID.H2,
  TAG_ID.H3,
  TAG_ID.H4,
  TAG_ID.H5,
  TAG_ID.H6,
  TAG_ID.HEAD,
  TAG_ID.HR,
  TAG_ID.I,
  TAG_ID.IMG,
  TAG_ID.LI,
  TAG_ID.LISTING,
  TAG_ID.MENU,
  TAG_ID.META,
  TAG_ID.NOBR,
  TAG_ID.OL,
  TAG_ID.P,
  TAG_ID.PRE,
  TAG_ID.RUBY,
  TAG_ID.S,
  TAG_ID.SMALL,
  TAG_ID.SPAN,
  TAG_ID.STRONG,
  TAG_ID.STRIKE,
  TAG_ID.SUB,
  TAG_ID.SUP,
  TAG_ID.TABLE,
  TAG_ID.TT,
  TAG_ID.U,
  TAG_ID.UL,
  TAG_ID.VAR
]);
function causesExit(startTagToken) {
  const tn = startTagToken.tagID;
  const isFontWithAttrs = tn === TAG_ID.FONT && startTagToken.attrs.some(({ name }) => name === ATTRS.COLOR || name === ATTRS.SIZE || name === ATTRS.FACE);
  return isFontWithAttrs || EXITS_FOREIGN_CONTENT.has(tn);
}
function adjustTokenMathMLAttrs(token) {
  for (let i2 = 0; i2 < token.attrs.length; i2++) {
    if (token.attrs[i2].name === DEFINITION_URL_ATTR) {
      token.attrs[i2].name = ADJUSTED_DEFINITION_URL_ATTR;
      break;
    }
  }
}
function adjustTokenSVGAttrs(token) {
  for (let i2 = 0; i2 < token.attrs.length; i2++) {
    const adjustedAttrName = SVG_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i2].name);
    if (adjustedAttrName != null) {
      token.attrs[i2].name = adjustedAttrName;
    }
  }
}
function adjustTokenXMLAttrs(token) {
  for (let i2 = 0; i2 < token.attrs.length; i2++) {
    const adjustedAttrEntry = XML_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i2].name);
    if (adjustedAttrEntry) {
      token.attrs[i2].prefix = adjustedAttrEntry.prefix;
      token.attrs[i2].name = adjustedAttrEntry.name;
      token.attrs[i2].namespace = adjustedAttrEntry.namespace;
    }
  }
}
function adjustTokenSVGTagName(token) {
  const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(token.tagName);
  if (adjustedTagName != null) {
    token.tagName = adjustedTagName;
    token.tagID = getTagID(token.tagName);
  }
}
function isMathMLTextIntegrationPoint(tn, ns) {
  return ns === NS.MATHML && (tn === TAG_ID.MI || tn === TAG_ID.MO || tn === TAG_ID.MN || tn === TAG_ID.MS || tn === TAG_ID.MTEXT);
}
function isHtmlIntegrationPoint(tn, ns, attrs) {
  if (ns === NS.MATHML && tn === TAG_ID.ANNOTATION_XML) {
    for (let i2 = 0; i2 < attrs.length; i2++) {
      if (attrs[i2].name === ATTRS.ENCODING) {
        const value = attrs[i2].value.toLowerCase();
        return value === MIME_TYPES.TEXT_HTML || value === MIME_TYPES.APPLICATION_XML;
      }
    }
  }
  return ns === NS.SVG && (tn === TAG_ID.FOREIGN_OBJECT || tn === TAG_ID.DESC || tn === TAG_ID.TITLE);
}
function isIntegrationPoint(tn, ns, attrs, foreignNS) {
  return (!foreignNS || foreignNS === NS.HTML) && isHtmlIntegrationPoint(tn, ns, attrs) || (!foreignNS || foreignNS === NS.MATHML) && isMathMLTextIntegrationPoint(tn, ns);
}

// node_modules/parse5/dist/parser/index.js
var INSERTION_MODE_TAGS = [
  TAG_ID.TR,
  TAG_ID.TBODY,
  TAG_ID.THEAD,
  TAG_ID.TFOOT,
  TAG_ID.CAPTION,
  TAG_ID.COLGROUP,
  TAG_ID.TABLE,
  TAG_ID.FRAMESET,
  TAG_ID.SELECT,
  TAG_ID.TEMPLATE,
  TAG_ID.TD,
  TAG_ID.TH,
  TAG_ID.HEAD,
  TAG_ID.BODY,
  TAG_ID.HTML
];
var HIDDEN_INPUT_TYPE = "hidden";
var EMPTY_ATTRS = [];
var AA_OUTER_LOOP_ITER = 8;
var AA_INNER_LOOP_ITER = 3;
var InsertionMode;
(function(InsertionMode2) {
  InsertionMode2[InsertionMode2["INITIAL"] = 0] = "INITIAL";
  InsertionMode2[InsertionMode2["BEFORE_HTML"] = 1] = "BEFORE_HTML";
  InsertionMode2[InsertionMode2["BEFORE_HEAD"] = 2] = "BEFORE_HEAD";
  InsertionMode2[InsertionMode2["IN_HEAD"] = 3] = "IN_HEAD";
  InsertionMode2[InsertionMode2["IN_HEAD_NO_SCRIPT"] = 4] = "IN_HEAD_NO_SCRIPT";
  InsertionMode2[InsertionMode2["AFTER_HEAD"] = 5] = "AFTER_HEAD";
  InsertionMode2[InsertionMode2["IN_BODY"] = 6] = "IN_BODY";
  InsertionMode2[InsertionMode2["TEXT"] = 7] = "TEXT";
  InsertionMode2[InsertionMode2["IN_TABLE"] = 8] = "IN_TABLE";
  InsertionMode2[InsertionMode2["IN_TABLE_TEXT"] = 9] = "IN_TABLE_TEXT";
  InsertionMode2[InsertionMode2["IN_CAPTION"] = 10] = "IN_CAPTION";
  InsertionMode2[InsertionMode2["IN_COLUMN_GROUP"] = 11] = "IN_COLUMN_GROUP";
  InsertionMode2[InsertionMode2["IN_TABLE_BODY"] = 12] = "IN_TABLE_BODY";
  InsertionMode2[InsertionMode2["IN_ROW"] = 13] = "IN_ROW";
  InsertionMode2[InsertionMode2["IN_CELL"] = 14] = "IN_CELL";
  InsertionMode2[InsertionMode2["IN_SELECT"] = 15] = "IN_SELECT";
  InsertionMode2[InsertionMode2["IN_SELECT_IN_TABLE"] = 16] = "IN_SELECT_IN_TABLE";
  InsertionMode2[InsertionMode2["IN_TEMPLATE"] = 17] = "IN_TEMPLATE";
  InsertionMode2[InsertionMode2["AFTER_BODY"] = 18] = "AFTER_BODY";
  InsertionMode2[InsertionMode2["IN_FRAMESET"] = 19] = "IN_FRAMESET";
  InsertionMode2[InsertionMode2["AFTER_FRAMESET"] = 20] = "AFTER_FRAMESET";
  InsertionMode2[InsertionMode2["AFTER_AFTER_BODY"] = 21] = "AFTER_AFTER_BODY";
  InsertionMode2[InsertionMode2["AFTER_AFTER_FRAMESET"] = 22] = "AFTER_AFTER_FRAMESET";
})(InsertionMode || (InsertionMode = {}));
var BASE_LOC = {
  startLine: -1,
  startCol: -1,
  startOffset: -1,
  endLine: -1,
  endCol: -1,
  endOffset: -1
};
var TABLE_STRUCTURE_TAGS = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TR]);
var defaultParserOptions = {
  scriptingEnabled: true,
  sourceCodeLocationInfo: false,
  treeAdapter: defaultTreeAdapter,
  onParseError: null
};
var Parser = class {
  constructor(options, document, fragmentContext = null, scriptHandler = null) {
    this.fragmentContext = fragmentContext;
    this.scriptHandler = scriptHandler;
    this.currentToken = null;
    this.stopped = false;
    this.insertionMode = InsertionMode.INITIAL;
    this.originalInsertionMode = InsertionMode.INITIAL;
    this.headElement = null;
    this.formElement = null;
    this.currentNotInHTML = false;
    this.tmplInsertionModeStack = [];
    this.pendingCharacterTokens = [];
    this.hasNonWhitespacePendingCharacterToken = false;
    this.framesetOk = true;
    this.skipNextNewLine = false;
    this.fosterParentingEnabled = false;
    this.options = {
      ...defaultParserOptions,
      ...options
    };
    this.treeAdapter = this.options.treeAdapter;
    this.onParseError = this.options.onParseError;
    if (this.onParseError) {
      this.options.sourceCodeLocationInfo = true;
    }
    this.document = document !== null && document !== void 0 ? document : this.treeAdapter.createDocument();
    this.tokenizer = new Tokenizer(this.options, this);
    this.activeFormattingElements = new FormattingElementList();
    this.fragmentContextID = fragmentContext ? getTagID(this.treeAdapter.getTagName(fragmentContext)) : TAG_ID.UNKNOWN;
    this._setContextModes(fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : this.document, this.fragmentContextID);
    this.openElements = new OpenElementStack(this.document, this.treeAdapter, this);
  }
  // API
  static parse(html, options) {
    const parser = new this(options);
    parser.tokenizer.write(html, true);
    return parser.document;
  }
  static getFragmentParser(fragmentContext, options) {
    const opts = {
      ...defaultParserOptions,
      ...options
    };
    fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : fragmentContext = opts.treeAdapter.createElement(TAG_NAMES.TEMPLATE, NS.HTML, []);
    const documentMock = opts.treeAdapter.createElement("documentmock", NS.HTML, []);
    const parser = new this(opts, documentMock, fragmentContext);
    if (parser.fragmentContextID === TAG_ID.TEMPLATE) {
      parser.tmplInsertionModeStack.push(InsertionMode.IN_TEMPLATE);
    }
    parser._initTokenizerForFragmentParsing();
    parser._insertFakeRootElement();
    parser._resetInsertionMode();
    parser._findFormInFragmentContext();
    return parser;
  }
  getFragment() {
    const rootElement = this.treeAdapter.getFirstChild(this.document);
    const fragment = this.treeAdapter.createDocumentFragment();
    this._adoptNodes(rootElement, fragment);
    return fragment;
  }
  //Errors
  /** @internal */
  _err(token, code, beforeToken) {
    var _a;
    if (!this.onParseError)
      return;
    const loc = (_a = token.location) !== null && _a !== void 0 ? _a : BASE_LOC;
    const err = {
      code,
      startLine: loc.startLine,
      startCol: loc.startCol,
      startOffset: loc.startOffset,
      endLine: beforeToken ? loc.startLine : loc.endLine,
      endCol: beforeToken ? loc.startCol : loc.endCol,
      endOffset: beforeToken ? loc.startOffset : loc.endOffset
    };
    this.onParseError(err);
  }
  //Stack events
  /** @internal */
  onItemPush(node, tid, isTop) {
    var _a, _b;
    (_b = (_a = this.treeAdapter).onItemPush) === null || _b === void 0 ? void 0 : _b.call(_a, node);
    if (isTop && this.openElements.stackTop > 0)
      this._setContextModes(node, tid);
  }
  /** @internal */
  onItemPop(node, isTop) {
    var _a, _b, _c;
    if (this.options.sourceCodeLocationInfo) {
      this._setEndLocation(node, this.currentToken);
    }
    (_b = (_a = this.treeAdapter).onItemPop) === null || _b === void 0 ? void 0 : _b.call(_a, node, this.openElements.current);
    (_c = this.annotationXmlIntegrationPoints) === null || _c === void 0 ? void 0 : _c.delete(node);
    if (isTop) {
      let current2;
      let currentTagId;
      if (this.openElements.stackTop === 0 && this.fragmentContext) {
        current2 = this.fragmentContext;
        currentTagId = this.fragmentContextID;
      } else {
        ({ current: current2, currentTagId } = this.openElements);
      }
      this._setContextModes(current2, currentTagId);
    }
  }
  _setContextModes(current2, tid) {
    const isHTML = current2 === this.document || current2 && this.treeAdapter.getNamespaceURI(current2) === NS.HTML;
    this.currentNotInHTML = !isHTML;
    this.tokenizer.inForeignNode = !isHTML && current2 !== void 0 && tid !== void 0 && !this._isIntegrationPoint(tid, current2);
  }
  /** @protected */
  _switchToTextParsing(currentToken, nextTokenizerState) {
    this._insertElement(currentToken, NS.HTML);
    this.tokenizer.state = nextTokenizerState;
    this.originalInsertionMode = this.insertionMode;
    this.insertionMode = InsertionMode.TEXT;
  }
  switchToPlaintextParsing() {
    this.insertionMode = InsertionMode.TEXT;
    this.originalInsertionMode = InsertionMode.IN_BODY;
    this.tokenizer.state = TokenizerMode.PLAINTEXT;
  }
  //Fragment parsing
  /** @protected */
  _getAdjustedCurrentElement() {
    return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
  }
  /** @protected */
  _findFormInFragmentContext() {
    let node = this.fragmentContext;
    while (node) {
      if (this.treeAdapter.getTagName(node) === TAG_NAMES.FORM && this.treeAdapter.getNamespaceURI(node) === NS.HTML) {
        this.formElement = node;
        break;
      }
      node = this.treeAdapter.getParentNode(node);
    }
  }
  _initTokenizerForFragmentParsing() {
    if (!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== NS.HTML) {
      return;
    }
    switch (this.fragmentContextID) {
      case TAG_ID.TITLE:
      case TAG_ID.TEXTAREA: {
        this.tokenizer.state = TokenizerMode.RCDATA;
        break;
      }
      case TAG_ID.STYLE:
      case TAG_ID.XMP:
      case TAG_ID.IFRAME:
      case TAG_ID.NOEMBED:
      case TAG_ID.NOFRAMES:
      case TAG_ID.NOSCRIPT: {
        this.tokenizer.state = TokenizerMode.RAWTEXT;
        break;
      }
      case TAG_ID.SCRIPT: {
        this.tokenizer.state = TokenizerMode.SCRIPT_DATA;
        break;
      }
      case TAG_ID.PLAINTEXT: {
        this.tokenizer.state = TokenizerMode.PLAINTEXT;
        break;
      }
      default:
    }
  }
  //Tree mutation
  /** @protected */
  _setDocumentType(token) {
    const name = token.name || "";
    const publicId = token.publicId || "";
    const systemId = token.systemId || "";
    this.treeAdapter.setDocumentType(this.document, name, publicId, systemId);
    if (token.location) {
      const documentChildren = this.treeAdapter.getChildNodes(this.document);
      const docTypeNode = documentChildren.find((node) => this.treeAdapter.isDocumentTypeNode(node));
      if (docTypeNode) {
        this.treeAdapter.setNodeSourceCodeLocation(docTypeNode, token.location);
      }
    }
  }
  /** @protected */
  _attachElementToTree(element, location, insertionLocation) {
    if (this.options.sourceCodeLocationInfo) {
      const loc = location && {
        ...location,
        startTag: location
      };
      this.treeAdapter.setNodeSourceCodeLocation(element, loc);
    }
    if (insertionLocation.beforeElement) {
      this.treeAdapter.insertBefore(insertionLocation.parent, element, insertionLocation.beforeElement);
    } else {
      this.treeAdapter.appendChild(insertionLocation.parent, element);
    }
  }
  /** @protected */
  _getInsertionLocation() {
    var _a;
    if (this._shouldFosterParentOnInsertion()) {
      return this._findFosterParentingLocation();
    }
    return {
      parent: (_a = this.openElements.currentTmplContentOrNode) !== null && _a !== void 0 ? _a : this.document,
      beforeElement: null
    };
  }
  /** @protected */
  _createElement(tagName, namespaceURI, attrs, intendedParent) {
    var _a, _b;
    const element = this.treeAdapter.createElement(tagName, namespaceURI, attrs);
    (_b = (_a = this.treeAdapter).onElementCreated) === null || _b === void 0 ? void 0 : _b.call(_a, element, {
      intendedParent,
      formElement: this.formElement,
      isInTemplate: this.openElements.tmplCount > 0
    });
    return element;
  }
  /**
   * For self-closing tags. Add an element to the tree, but skip adding it
   * to the stack.
   */
  /** @protected */
  _appendElement(token, namespaceURI) {
    const insertionLocation = this._getInsertionLocation();
    const element = this._createElement(token.tagName, namespaceURI, token.attrs, insertionLocation.parent);
    this._attachElementToTree(element, token.location, insertionLocation);
  }
  /** @protected */
  _insertElement(token, namespaceURI) {
    const insertionLocation = this._getInsertionLocation();
    const element = this._createElement(token.tagName, namespaceURI, token.attrs, insertionLocation.parent);
    this._attachElementToTree(element, token.location, insertionLocation);
    this.openElements.push(element, token.tagID);
  }
  /** @protected */
  _insertFakeElement(tagName, tagID) {
    const insertionLocation = this._getInsertionLocation();
    const element = this._createElement(tagName, NS.HTML, [], insertionLocation.parent);
    this._attachElementToTree(element, null, insertionLocation);
    this.openElements.push(element, tagID);
  }
  /** @protected */
  _insertTemplate(token) {
    const insertionLocation = this._getInsertionLocation();
    const tmpl = this._createElement(token.tagName, NS.HTML, token.attrs, insertionLocation.parent);
    const content = this.treeAdapter.createDocumentFragment();
    this.treeAdapter.setTemplateContent(tmpl, content);
    this._attachElementToTree(tmpl, token.location, insertionLocation);
    this.openElements.push(tmpl, token.tagID);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(content, null);
  }
  /** @protected */
  _insertFakeRootElement() {
    const element = this._createElement(TAG_NAMES.HTML, NS.HTML, [], this.document);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(element, null);
    this.treeAdapter.appendChild(this.document, element);
    this.openElements.push(element, TAG_ID.HTML);
  }
  /** @protected */
  _appendCommentNode(token, parent) {
    const commentNode = this.treeAdapter.createCommentNode(token.data);
    this.treeAdapter.appendChild(parent, commentNode);
    if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(commentNode, token.location);
    }
  }
  /** @protected */
  _insertCharacters(token) {
    let parent;
    let beforeElement;
    if (this._shouldFosterParentOnInsertion()) {
      ({ parent, beforeElement } = this._findFosterParentingLocation());
      if (beforeElement) {
        this.treeAdapter.insertTextBefore(parent, token.chars, beforeElement);
      } else {
        this.treeAdapter.insertText(parent, token.chars);
      }
    } else {
      parent = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.insertText(parent, token.chars);
    }
    if (!token.location)
      return;
    const siblings = this.treeAdapter.getChildNodes(parent);
    const textNodeIdx = beforeElement ? siblings.lastIndexOf(beforeElement) : siblings.length;
    const textNode = siblings[textNodeIdx - 1];
    const tnLoc = this.treeAdapter.getNodeSourceCodeLocation(textNode);
    if (tnLoc) {
      const { endLine, endCol, endOffset } = token.location;
      this.treeAdapter.updateNodeSourceCodeLocation(textNode, { endLine, endCol, endOffset });
    } else if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(textNode, token.location);
    }
  }
  /** @protected */
  _adoptNodes(donor, recipient) {
    const children = [...this.treeAdapter.getChildNodes(donor)];
    for (let i2 = children.length - 1; i2 >= 0; i2--) {
      this.treeAdapter.detachNode(children[i2]);
    }
    for (const child of children) {
      this.treeAdapter.appendChild(recipient, child);
    }
  }
  /** @protected */
  _setEndLocation(element, closingToken) {
    if (this.treeAdapter.getNodeSourceCodeLocation(element) && closingToken.location) {
      const ctLoc = closingToken.location;
      const tn = this.treeAdapter.getTagName(element);
      const endLoc = (
        // NOTE: For cases like <p> <p> </p> - First 'p' closes without a closing
        // tag and for cases like <td> <p> </td> - 'p' closes without a closing tag.
        closingToken.type === TokenType.END_TAG && tn === closingToken.tagName ? {
          endTag: { ...ctLoc },
          endLine: ctLoc.endLine,
          endCol: ctLoc.endCol,
          endOffset: ctLoc.endOffset
        } : {
          endLine: ctLoc.startLine,
          endCol: ctLoc.startCol,
          endOffset: ctLoc.startOffset
        }
      );
      this.treeAdapter.updateNodeSourceCodeLocation(element, endLoc);
    }
  }
  //Token processing
  shouldProcessStartTagTokenInForeignContent(token) {
    if (!this.currentNotInHTML)
      return false;
    let current2;
    let currentTagId;
    if (this.openElements.stackTop === 0 && this.fragmentContext) {
      current2 = this.fragmentContext;
      currentTagId = this.fragmentContextID;
    } else {
      ({ current: current2, currentTagId } = this.openElements);
    }
    if (token.tagID === TAG_ID.SVG && this.treeAdapter.getTagName(current2) === TAG_NAMES.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(current2) === NS.MATHML) {
      return false;
    }
    return (
      // Check that `current` is not an integration point for HTML or MathML elements.
      this.tokenizer.inForeignNode || // If it _is_ an integration point, then we might have to check that it is not an HTML
      // integration point.
      (token.tagID === TAG_ID.MGLYPH || token.tagID === TAG_ID.MALIGNMARK) && currentTagId !== void 0 && !this._isIntegrationPoint(currentTagId, current2, NS.HTML)
    );
  }
  /** @protected */
  _processToken(token) {
    switch (token.type) {
      case TokenType.CHARACTER: {
        this.onCharacter(token);
        break;
      }
      case TokenType.NULL_CHARACTER: {
        this.onNullCharacter(token);
        break;
      }
      case TokenType.COMMENT: {
        this.onComment(token);
        break;
      }
      case TokenType.DOCTYPE: {
        this.onDoctype(token);
        break;
      }
      case TokenType.START_TAG: {
        this._processStartTag(token);
        break;
      }
      case TokenType.END_TAG: {
        this.onEndTag(token);
        break;
      }
      case TokenType.EOF: {
        this.onEof(token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        this.onWhitespaceCharacter(token);
        break;
      }
    }
  }
  /** @protected */
  _isIntegrationPoint(tid, element, foreignNS) {
    var _a;
    const ns = this.treeAdapter.getNamespaceURI(element);
    if (tid === TAG_ID.ANNOTATION_XML && ns === NS.MATHML && foreignNS !== NS.MATHML) {
      const verdicts = (_a = this.annotationXmlIntegrationPoints) !== null && _a !== void 0 ? _a : this.annotationXmlIntegrationPoints = /* @__PURE__ */ new Map();
      let isIntegrationPoint2 = verdicts.get(element);
      if (isIntegrationPoint2 === void 0) {
        isIntegrationPoint2 = isIntegrationPoint(tid, ns, this.treeAdapter.getAttrList(element));
        verdicts.set(element, isIntegrationPoint2);
      }
      return isIntegrationPoint2;
    }
    return isIntegrationPoint(tid, ns, EMPTY_ATTRS, foreignNS);
  }
  //Active formatting elements reconstruction
  /** @protected */
  _reconstructActiveFormattingElements() {
    let oldest = null;
    for (let entry = this.activeFormattingElements.newest; entry !== null && entry.type === EntryType.Element && !this.openElements.contains(entry.element); entry = entry.older) {
      oldest = entry;
    }
    for (let entry = oldest; entry !== null && entry.type === EntryType.Element; entry = entry.newer) {
      this._insertElement(entry.token, this.treeAdapter.getNamespaceURI(entry.element));
      this.activeFormattingElements.replaceElement(entry, this.openElements.current);
    }
  }
  //Close elements
  /** @protected */
  _closeTableCell() {
    this.openElements.generateImpliedEndTags();
    this.openElements.popUntilTableCellPopped();
    this.activeFormattingElements.clearToLastMarker();
    this.insertionMode = InsertionMode.IN_ROW;
  }
  /** @protected */
  _closePElement() {
    this.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.P);
    this.openElements.popUntilTagNamePopped(TAG_ID.P);
  }
  //Insertion modes
  /** @protected */
  _resetInsertionMode() {
    const i2 = this.openElements.indexOfTopmostOf(INSERTION_MODE_TAGS);
    const tn = i2 === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[i2];
    const node = i2 === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.items[i2];
    if (node !== void 0 && this.treeAdapter.getNamespaceURI(node) === NS.HTML) {
      switch (tn) {
        case TAG_ID.TR: {
          this.insertionMode = InsertionMode.IN_ROW;
          return;
        }
        case TAG_ID.TBODY:
        case TAG_ID.THEAD:
        case TAG_ID.TFOOT: {
          this.insertionMode = InsertionMode.IN_TABLE_BODY;
          return;
        }
        case TAG_ID.CAPTION: {
          this.insertionMode = InsertionMode.IN_CAPTION;
          return;
        }
        case TAG_ID.COLGROUP: {
          this.insertionMode = InsertionMode.IN_COLUMN_GROUP;
          return;
        }
        case TAG_ID.TABLE: {
          this.insertionMode = InsertionMode.IN_TABLE;
          return;
        }
        case TAG_ID.BODY: {
          this.insertionMode = InsertionMode.IN_BODY;
          return;
        }
        case TAG_ID.FRAMESET: {
          this.insertionMode = InsertionMode.IN_FRAMESET;
          return;
        }
        case TAG_ID.SELECT: {
          this._resetInsertionModeForSelect(i2);
          return;
        }
        case TAG_ID.TEMPLATE: {
          this.insertionMode = this.tmplInsertionModeStack[this.tmplInsertionModeStack.length - 1];
          return;
        }
        case TAG_ID.HTML: {
          this.insertionMode = this.headElement ? InsertionMode.AFTER_HEAD : InsertionMode.BEFORE_HEAD;
          return;
        }
        case TAG_ID.TD:
        case TAG_ID.TH: {
          if (i2 > 0) {
            this.insertionMode = InsertionMode.IN_CELL;
            return;
          }
          break;
        }
        case TAG_ID.HEAD: {
          if (i2 > 0) {
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
          }
          break;
        }
      }
    }
    this.insertionMode = InsertionMode.IN_BODY;
  }
  /** @protected */
  _resetInsertionModeForSelect(selectIdx) {
    if (selectIdx > 0) {
      const tableIdx = this.openElements.indexOfTopmost(TAG_ID.TABLE);
      if (tableIdx > 0 && tableIdx > this.openElements.indexOfTopmost(TAG_ID.TEMPLATE)) {
        this.insertionMode = InsertionMode.IN_SELECT_IN_TABLE;
        return;
      }
    }
    this.insertionMode = InsertionMode.IN_SELECT;
  }
  //Foster parenting
  /** @protected */
  _isElementCausesFosterParenting(tn) {
    return TABLE_STRUCTURE_TAGS.has(tn);
  }
  /** @protected */
  _shouldFosterParentOnInsertion() {
    return this.fosterParentingEnabled && this.openElements.currentTagId !== void 0 && this._isElementCausesFosterParenting(this.openElements.currentTagId);
  }
  /** @protected */
  _findFosterParentingLocation() {
    const { openElements } = this;
    const tableIdx = openElements.indexOfTopmost(TAG_ID.TABLE);
    const templateIdx = openElements.indexOfTopmost(TAG_ID.TEMPLATE);
    if (templateIdx > tableIdx) {
      return {
        parent: this.treeAdapter.getTemplateContent(openElements.items[templateIdx]),
        beforeElement: null
      };
    }
    if (tableIdx !== -1) {
      const table2 = openElements.items[tableIdx];
      const parent = this.treeAdapter.getParentNode(table2);
      if (parent) {
        return { parent, beforeElement: table2 };
      }
      return { parent: openElements.items[openElements.slotBelow(tableIdx)], beforeElement: null };
    }
    return { parent: openElements.items[0], beforeElement: null };
  }
  /** @protected */
  _fosterParentElement(element) {
    const location = this._findFosterParentingLocation();
    if (location.beforeElement) {
      this.treeAdapter.insertBefore(location.parent, element, location.beforeElement);
    } else {
      this.treeAdapter.appendChild(location.parent, element);
    }
  }
  //Special elements
  /** @protected */
  _isSpecialElement(element, id) {
    const ns = this.treeAdapter.getNamespaceURI(element);
    return SPECIAL_ELEMENTS[ns].has(id);
  }
  /** @internal */
  onCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      characterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE: {
        characterInBody(this, token);
        break;
      }
      case InsertionMode.TEXT:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        characterInTableText(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onNullCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      nullCharacterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onComment(token) {
    this.skipNextNewLine = false;
    if (this.currentNotInHTML) {
      appendComment(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL:
      case InsertionMode.BEFORE_HTML:
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        appendComment(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        appendCommentToRootHtmlElement(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        appendCommentToDocument(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onDoctype(token) {
    this.skipNextNewLine = false;
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        doctypeInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD: {
        this._err(token, ERR.misplacedDoctype);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onStartTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    this._processStartTag(token);
    if (token.selfClosing && !token.ackSelfClosing) {
      this._err(token, ERR.nonVoidHtmlElementStartTagWithTrailingSolidus);
    }
  }
  /**
   * Processes a given start tag.
   *
   * `onStartTag` checks if a self-closing tag was recognized. When a token
   * is moved inbetween multiple insertion modes, this check for self-closing
   * could lead to false positives. To avoid this, `_processStartTag` is used
   * for nested calls.
   *
   * @param token The token to process.
   * @protected
   */
  _processStartTag(token) {
    if (this.shouldProcessStartTagTokenInForeignContent(token)) {
      startTagInForeignContent(this, token);
    } else {
      this._startTagOutsideForeignContent(token);
    }
  }
  /** @protected */
  _startTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        startTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        startTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        startTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        startTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        startTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        startTagInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        startTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        startTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        startTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        startTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        startTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        startTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        startTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        startTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        startTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        startTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        startTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        startTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        startTagAfterAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        startTagAfterAfterFrameset(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onEndTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    if (this.currentNotInHTML) {
      endTagInForeignContent(this, token);
    } else {
      this._endTagOutsideForeignContent(token);
    }
  }
  /** @protected */
  _endTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        endTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        endTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        endTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        endTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        endTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        endTagInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        endTagInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        endTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        endTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        endTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        endTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        endTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        endTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        endTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        endTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        endTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        endTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        endTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        endTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onEof(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        eofInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        eofInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        eofInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        stopParsing(this, token);
        break;
      }
      default:
    }
  }
  /** @internal */
  onWhitespaceCharacter(token) {
    if (this.skipNextNewLine) {
      this.skipNextNewLine = false;
      if (token.chars.charCodeAt(0) === CODE_POINTS.LINE_FEED) {
        if (token.chars.length === 1) {
          return;
        }
        token.chars = token.chars.substr(1);
      }
    }
    if (this.tokenizer.inForeignNode) {
      this._insertCharacters(token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.TEXT:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.AFTER_BODY:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        whitespaceCharacterInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        whitespaceCharacterInTableText(this, token);
        break;
      }
      default:
    }
  }
};
function aaObtainFormattingElementEntry(p, token) {
  let formattingElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(token.tagName);
  if (formattingElementEntry) {
    if (!p.openElements.contains(formattingElementEntry.element)) {
      p.activeFormattingElements.removeEntry(formattingElementEntry);
      formattingElementEntry = null;
    } else if (!p.openElements.hasInScope(token.tagID, formattingElementEntry.element)) {
      formattingElementEntry = null;
    }
  } else {
    genericEndTagInBody(p, token);
  }
  return formattingElementEntry;
}
function aaObtainFurthestBlock(p, formattingElementEntry) {
  const { openElements } = p;
  const formattingIdx = openElements._indexOf(formattingElementEntry.element);
  for (let idx = openElements.slotAbove(formattingIdx); idx !== -1; idx = openElements.slotAbove(idx)) {
    if (p._isSpecialElement(openElements.items[idx], openElements.tagIDs[idx])) {
      return idx;
    }
  }
  openElements.shortenToLength(formattingIdx);
  p.activeFormattingElements.removeEntry(formattingElementEntry);
  return -1;
}
function aaInnerLoop(p, furthestBlockIdx, formattingElement) {
  const furthestBlock = p.openElements.items[furthestBlockIdx];
  let lastElement = furthestBlock;
  let nextIdx = p.openElements.slotBelow(furthestBlockIdx);
  const intendedParent = p.openElements.getCommonAncestor(formattingElement);
  for (let i2 = 0, idx = nextIdx; p.openElements.items[idx] !== formattingElement; i2++, idx = nextIdx) {
    let element = p.openElements.items[idx];
    nextIdx = p.openElements.slotBelow(idx);
    const elementEntry = p.activeFormattingElements.getElementEntry(element);
    const counterOverflow = elementEntry && i2 >= AA_INNER_LOOP_ITER;
    const shouldRemoveFromOpenElements = !elementEntry || counterOverflow;
    if (shouldRemoveFromOpenElements) {
      if (counterOverflow) {
        p.activeFormattingElements.removeEntry(elementEntry);
      }
      p.openElements.removeAt(idx);
    } else {
      element = aaRecreateElementFromEntry(p, elementEntry, intendedParent);
      if (lastElement === furthestBlock) {
        p.activeFormattingElements.bookmark = elementEntry;
      }
      p.treeAdapter.detachNode(lastElement);
      p.treeAdapter.appendChild(element, lastElement);
      lastElement = element;
    }
  }
  return lastElement;
}
function aaRecreateElementFromEntry(p, elementEntry, intendedParent) {
  const ns = p.treeAdapter.getNamespaceURI(elementEntry.element);
  const newElement = p._createElement(elementEntry.token.tagName, ns, elementEntry.token.attrs, intendedParent);
  p.openElements.replace(elementEntry.element, newElement);
  p.activeFormattingElements.replaceElement(elementEntry, newElement);
  return newElement;
}
function aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement) {
  const tn = p.treeAdapter.getTagName(commonAncestor);
  const tid = getTagID(tn);
  if (p._isElementCausesFosterParenting(tid)) {
    p._fosterParentElement(lastElement);
  } else {
    const ns = p.treeAdapter.getNamespaceURI(commonAncestor);
    if (tid === TAG_ID.TEMPLATE && ns === NS.HTML) {
      commonAncestor = p.treeAdapter.getTemplateContent(commonAncestor);
    }
    p.treeAdapter.appendChild(commonAncestor, lastElement);
  }
}
function aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry) {
  const ns = p.treeAdapter.getNamespaceURI(formattingElementEntry.element);
  const { token } = formattingElementEntry;
  const newElement = p._createElement(token.tagName, ns, token.attrs, furthestBlock);
  p._adoptNodes(furthestBlock, newElement);
  p.treeAdapter.appendChild(furthestBlock, newElement);
  p.activeFormattingElements.insertElementAfterBookmark(newElement, token);
  p.activeFormattingElements.removeEntry(formattingElementEntry);
  const formattingIdx = p.openElements._indexOf(formattingElementEntry.element);
  let furthestBlockIdx = p.openElements.slotAbove(formattingIdx);
  while (p.openElements.items[furthestBlockIdx] !== furthestBlock) {
    furthestBlockIdx = p.openElements.slotAbove(furthestBlockIdx);
  }
  p.openElements.replaceFormattingElement(formattingIdx, furthestBlockIdx, newElement, token.tagID);
}
function callAdoptionAgency(p, token) {
  const { current: current2, currentTagId } = p.openElements;
  if (currentTagId === token.tagID && p.treeAdapter.getNamespaceURI(current2) === NS.HTML && !p.activeFormattingElements.getElementEntry(current2)) {
    p.openElements.pop();
    return;
  }
  for (let i2 = 0; i2 < AA_OUTER_LOOP_ITER; i2++) {
    const formattingElementEntry = aaObtainFormattingElementEntry(p, token);
    if (!formattingElementEntry) {
      break;
    }
    const furthestBlockIdx = aaObtainFurthestBlock(p, formattingElementEntry);
    if (furthestBlockIdx === -1) {
      break;
    }
    const furthestBlock = p.openElements.items[furthestBlockIdx];
    p.activeFormattingElements.bookmark = formattingElementEntry;
    const lastElement = aaInnerLoop(p, furthestBlockIdx, formattingElementEntry.element);
    const commonAncestor = p.openElements.getCommonAncestor(formattingElementEntry.element);
    p.treeAdapter.detachNode(lastElement);
    if (commonAncestor)
      aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement);
    aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry);
  }
}
function appendComment(p, token) {
  p._appendCommentNode(token, p.openElements.currentTmplContentOrNode);
}
function appendCommentToRootHtmlElement(p, token) {
  p._appendCommentNode(token, p.openElements.items[0]);
}
function appendCommentToDocument(p, token) {
  p._appendCommentNode(token, p.document);
}
function stopParsing(p, token) {
  p.stopped = true;
  if (token.location) {
    const target = p.fragmentContext ? 0 : 2;
    for (let i2 = p.openElements.stackTop; i2 >= target; i2 = p.openElements.slotBelow(i2)) {
      p._setEndLocation(p.openElements.items[i2], token);
    }
    if (!p.fragmentContext && p.openElements.stackTop >= 0) {
      const htmlElement = p.openElements.items[0];
      const htmlLocation = p.treeAdapter.getNodeSourceCodeLocation(htmlElement);
      if (htmlLocation && !htmlLocation.endTag) {
        p._setEndLocation(htmlElement, token);
        if (p.openElements.stackTop >= 1) {
          const bodyElement = p.openElements.items[1];
          const bodyLocation = p.treeAdapter.getNodeSourceCodeLocation(bodyElement);
          if (bodyLocation && !bodyLocation.endTag) {
            p._setEndLocation(bodyElement, token);
          }
        }
      }
    }
  }
}
function doctypeInInitialMode(p, token) {
  p._setDocumentType(token);
  const mode = token.forceQuirks ? DOCUMENT_MODE.QUIRKS : getDocumentMode(token);
  if (!isConforming(token)) {
    p._err(token, ERR.nonConformingDoctype);
  }
  p.treeAdapter.setDocumentMode(p.document, mode);
  p.insertionMode = InsertionMode.BEFORE_HTML;
}
function tokenInInitialMode(p, token) {
  p._err(token, ERR.missingDoctype, true);
  p.treeAdapter.setDocumentMode(p.document, DOCUMENT_MODE.QUIRKS);
  p.insertionMode = InsertionMode.BEFORE_HTML;
  p._processToken(token);
}
function startTagBeforeHtml(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.BEFORE_HEAD;
  } else {
    tokenBeforeHtml(p, token);
  }
}
function endTagBeforeHtml(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HTML || tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.BR) {
    tokenBeforeHtml(p, token);
  }
}
function tokenBeforeHtml(p, token) {
  p._insertFakeRootElement();
  p.insertionMode = InsertionMode.BEFORE_HEAD;
  p._processToken(token);
}
function startTagBeforeHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.HEAD: {
      p._insertElement(token, NS.HTML);
      p.headElement = p.openElements.current;
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    default: {
      tokenBeforeHead(p, token);
    }
  }
}
function endTagBeforeHead(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.HTML || tn === TAG_ID.BR) {
    tokenBeforeHead(p, token);
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenBeforeHead(p, token) {
  p._insertFakeElement(TAG_NAMES.HEAD, TAG_ID.HEAD);
  p.headElement = p.openElements.current;
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TITLE: {
      p._switchToTextParsing(token, TokenizerMode.RCDATA);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      } else {
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_HEAD_NO_SCRIPT;
      }
      break;
    }
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      break;
    }
    case TAG_ID.SCRIPT: {
      p._switchToTextParsing(token, TokenizerMode.SCRIPT_DATA);
      break;
    }
    case TAG_ID.TEMPLATE: {
      p._insertTemplate(token);
      p.activeFormattingElements.insertMarker();
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_TEMPLATE;
      p.tmplInsertionModeStack.push(InsertionMode.IN_TEMPLATE);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenInHead(p, token);
    }
  }
}
function endTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HEAD: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.AFTER_HEAD;
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.BR:
    case TAG_ID.HTML: {
      tokenInHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function templateEndTagInHead(p, token) {
  if (p.openElements.tmplCount > 0) {
    p.openElements.generateImpliedEndTagsThoroughly();
    if (p.openElements.currentTagId !== TAG_ID.TEMPLATE) {
      p._err(token, ERR.closingOfElementWithOpenChildElements);
    }
    p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
    p.activeFormattingElements.clearToLastMarker();
    p.tmplInsertionModeStack.pop();
    p._resetInsertionMode();
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenInHead(p, token) {
  p.openElements.pop();
  p.insertionMode = InsertionMode.AFTER_HEAD;
  p._processToken(token);
}
function startTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.HEAD:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      p._err(token, ERR.nestedNoscriptInHead);
      break;
    }
    default: {
      tokenInHeadNoScript(p, token);
    }
  }
}
function endTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.NOSCRIPT: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    case TAG_ID.BR: {
      tokenInHeadNoScript(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenInHeadNoScript(p, token) {
  const errCode = token.type === TokenType.EOF ? ERR.openElementsLeftAfterEof : ERR.disallowedContentInNoscriptInHead;
  p._err(token, errCode);
  p.openElements.pop();
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BODY: {
      p._insertElement(token, NS.HTML);
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_BODY;
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_FRAMESET;
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      p._err(token, ERR.abandonedHeadElementChild);
      p.openElements.push(p.headElement, TAG_ID.HEAD);
      startTagInHead(p, token);
      p.openElements.remove(p.headElement);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenAfterHead(p, token);
    }
  }
}
function endTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.BODY:
    case TAG_ID.HTML:
    case TAG_ID.BR: {
      tokenAfterHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenAfterHead(p, token) {
  p._insertFakeElement(TAG_NAMES.BODY, TAG_ID.BODY);
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function modeInBody(p, token) {
  switch (token.type) {
    case TokenType.CHARACTER: {
      characterInBody(p, token);
      break;
    }
    case TokenType.WHITESPACE_CHARACTER: {
      whitespaceCharacterInBody(p, token);
      break;
    }
    case TokenType.COMMENT: {
      appendComment(p, token);
      break;
    }
    case TokenType.START_TAG: {
      startTagInBody(p, token);
      break;
    }
    case TokenType.END_TAG: {
      endTagInBody(p, token);
      break;
    }
    case TokenType.EOF: {
      eofInBody(p, token);
      break;
    }
    default:
  }
}
function whitespaceCharacterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
}
function characterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
  p.framesetOk = false;
}
function htmlStartTagInBody(p, token) {
  if (p.openElements.tmplCount === 0) {
    p.treeAdapter.adoptAttributes(p.openElements.items[0], token.attrs);
  }
}
function bodyStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (bodyElement && p.openElements.tmplCount === 0) {
    p.framesetOk = false;
    p.treeAdapter.adoptAttributes(bodyElement, token.attrs);
  }
}
function framesetStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (p.framesetOk && bodyElement) {
    p.treeAdapter.detachNode(bodyElement);
    p.openElements.popAllUpToHtmlElement();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_FRAMESET;
  }
}
function addressStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function numberedHeaderStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  if (p.openElements.currentTagId !== void 0 && NUMBERED_HEADERS.has(p.openElements.currentTagId)) {
    p.openElements.pop();
  }
  p._insertElement(token, NS.HTML);
}
function preStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.framesetOk = false;
}
function formStartTagInBody(p, token) {
  const inTemplate = p.openElements.tmplCount > 0;
  if (!p.formElement || inTemplate) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    if (!inTemplate) {
      p.formElement = p.openElements.current;
    }
  }
}
function listItemStartTagInBody(p, token) {
  p.framesetOk = false;
  const idx = token.tagID === TAG_ID.LI ? p.openElements.indexOfTopmost(TAG_ID.LI) : Math.max(p.openElements.indexOfTopmost(TAG_ID.DD), p.openElements.indexOfTopmost(TAG_ID.DT));
  if (idx !== -1 && !p.openElements.hasListItemBoundaryAbove(idx)) {
    const elementId = p.openElements.tagIDs[idx];
    p.openElements.generateImpliedEndTagsWithExclusion(elementId);
    p.openElements.popUntilTagNamePopped(elementId);
  }
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function plaintextStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.tokenizer.state = TokenizerMode.PLAINTEXT;
}
function buttonStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BUTTON)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(TAG_ID.BUTTON);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
}
function aStartTagInBody(p, token) {
  const activeElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(TAG_NAMES.A);
  if (activeElementEntry) {
    callAdoptionAgency(p, token);
    p.openElements.remove(activeElementEntry.element);
    p.activeFormattingElements.removeEntry(activeElementEntry);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function bStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function nobrStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  if (p.openElements.hasInScope(TAG_ID.NOBR)) {
    callAdoptionAgency(p, token);
    p._reconstructActiveFormattingElements();
  }
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function appletStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.insertMarker();
  p.framesetOk = false;
}
function tableStartTagInBody(p, token) {
  if (p.treeAdapter.getDocumentMode(p.document) !== DOCUMENT_MODE.QUIRKS && p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = InsertionMode.IN_TABLE;
}
function areaStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function isHiddenInput(token) {
  const inputType = getTokenAttr(token, ATTRS.TYPE);
  return inputType != null && inputType.toLowerCase() === HIDDEN_INPUT_TYPE;
}
function inputStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  if (!isHiddenInput(token)) {
    p.framesetOk = false;
  }
  token.ackSelfClosing = true;
}
function paramStartTagInBody(p, token) {
  p._appendElement(token, NS.HTML);
  token.ackSelfClosing = true;
}
function hrStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function imageStartTagInBody(p, token) {
  token.tagName = TAG_NAMES.IMG;
  token.tagID = TAG_ID.IMG;
  areaStartTagInBody(p, token);
}
function textareaStartTagInBody(p, token) {
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.tokenizer.state = TokenizerMode.RCDATA;
  p.originalInsertionMode = p.insertionMode;
  p.framesetOk = false;
  p.insertionMode = InsertionMode.TEXT;
}
function xmpStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._reconstructActiveFormattingElements();
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function iframeStartTagInBody(p, token) {
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function rawTextStartTagInBody(p, token) {
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function selectStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = p.insertionMode === InsertionMode.IN_TABLE || p.insertionMode === InsertionMode.IN_CAPTION || p.insertionMode === InsertionMode.IN_TABLE_BODY || p.insertionMode === InsertionMode.IN_ROW || p.insertionMode === InsertionMode.IN_CELL ? InsertionMode.IN_SELECT_IN_TABLE : InsertionMode.IN_SELECT;
}
function optgroupStartTagInBody(p, token) {
  if (p.openElements.currentTagId === TAG_ID.OPTION) {
    p.openElements.pop();
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function rbStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTags();
  }
  p._insertElement(token, NS.HTML);
}
function rtStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.RTC);
  }
  p._insertElement(token, NS.HTML);
}
function mathStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenMathMLAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.MATHML);
  } else {
    p._insertElement(token, NS.MATHML);
  }
  token.ackSelfClosing = true;
}
function svgStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenSVGAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.SVG);
  } else {
    p._insertElement(token, NS.SVG);
  }
  token.ackSelfClosing = true;
}
function genericStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function startTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.B:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      bStartTagInBody(p, token);
      break;
    }
    case TAG_ID.A: {
      aStartTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderStartTagInBody(p, token);
      break;
    }
    case TAG_ID.P:
    case TAG_ID.DL:
    case TAG_ID.OL:
    case TAG_ID.UL:
    case TAG_ID.DIV:
    case TAG_ID.DIR:
    case TAG_ID.NAV:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.DETAILS:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressStartTagInBody(p, token);
      break;
    }
    case TAG_ID.LI:
    case TAG_ID.DD:
    case TAG_ID.DT: {
      listItemStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BR:
    case TAG_ID.IMG:
    case TAG_ID.WBR:
    case TAG_ID.AREA:
    case TAG_ID.EMBED:
    case TAG_ID.KEYGEN: {
      areaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HR: {
      hrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RB:
    case TAG_ID.RTC: {
      rbStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RT:
    case TAG_ID.RP: {
      rtStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PRE:
    case TAG_ID.LISTING: {
      preStartTagInBody(p, token);
      break;
    }
    case TAG_ID.XMP: {
      xmpStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SVG: {
      svgStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.STYLE:
    case TAG_ID.TITLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.BGSOUND:
    case TAG_ID.BASEFONT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY: {
      bodyStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOBR: {
      nobrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.MATH: {
      mathStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInBody(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PARAM:
    case TAG_ID.TRACK:
    case TAG_ID.SOURCE: {
      paramStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IMAGE: {
      imageStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BUTTON: {
      buttonStartTagInBody(p, token);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IFRAME: {
      iframeStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SELECT: {
      selectStartTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION:
    case TAG_ID.OPTGROUP: {
      optgroupStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOEMBED:
    case TAG_ID.NOFRAMES: {
      rawTextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      framesetStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TEXTAREA: {
      textareaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        rawTextStartTagInBody(p, token);
      } else {
        genericStartTagInBody(p, token);
      }
      break;
    }
    case TAG_ID.PLAINTEXT: {
      plaintextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.COL:
    case TAG_ID.TH:
    case TAG_ID.TD:
    case TAG_ID.TR:
    case TAG_ID.HEAD:
    case TAG_ID.FRAME:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP: {
      break;
    }
    default: {
      genericStartTagInBody(p, token);
    }
  }
}
function bodyEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    if (p.options.sourceCodeLocationInfo) {
      const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
      if (bodyElement) {
        p._setEndLocation(bodyElement, token);
      }
    }
  }
}
function htmlEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    endTagAfterBody(p, token);
  }
}
function addressEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function formEndTagInBody(p) {
  const inTemplate = p.openElements.tmplCount > 0;
  const { formElement } = p;
  if (!inTemplate) {
    p.formElement = null;
  }
  if ((formElement || inTemplate) && p.openElements.hasInScope(TAG_ID.FORM)) {
    p.openElements.generateImpliedEndTags();
    if (inTemplate) {
      p.openElements.popUntilTagNamePopped(TAG_ID.FORM);
    } else if (formElement) {
      p.openElements.remove(formElement);
    }
  }
}
function pEndTagInBody(p) {
  if (!p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._insertFakeElement(TAG_NAMES.P, TAG_ID.P);
  }
  p._closePElement();
}
function liEndTagInBody(p) {
  if (p.openElements.hasInListItemScope(TAG_ID.LI)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.LI);
    p.openElements.popUntilTagNamePopped(TAG_ID.LI);
  }
}
function ddEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTagsWithExclusion(tn);
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function numberedHeaderEndTagInBody(p) {
  if (p.openElements.hasNumberedHeaderInScope()) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilNumberedHeaderPopped();
  }
}
function appletEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
    p.activeFormattingElements.clearToLastMarker();
  }
}
function brEndTagInBody(p) {
  p._reconstructActiveFormattingElements();
  p._insertFakeElement(TAG_NAMES.BR, TAG_ID.BR);
  p.openElements.pop();
  p.framesetOk = false;
}
function genericEndTagInBody(p, token) {
  const tid = token.tagID;
  const i2 = tid === TAG_ID.UNKNOWN ? p.openElements.indexOfTopmostByName(NS.HTML, token.tagName) : p.openElements.indexOfTopmost(tid);
  if (i2 > 0 && !p.openElements.hasSpecialElementAbove(i2)) {
    p.openElements.generateImpliedEndTagsWithExclusion(tid);
    if (p.openElements.stackTop >= i2)
      p.openElements.shortenToLength(i2);
  }
}
function endTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.A:
    case TAG_ID.B:
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.NOBR:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      callAdoptionAgency(p, token);
      break;
    }
    case TAG_ID.P: {
      pEndTagInBody(p);
      break;
    }
    case TAG_ID.DL:
    case TAG_ID.UL:
    case TAG_ID.OL:
    case TAG_ID.DIR:
    case TAG_ID.DIV:
    case TAG_ID.NAV:
    case TAG_ID.PRE:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.BUTTON:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.DETAILS:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.LISTING:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressEndTagInBody(p, token);
      break;
    }
    case TAG_ID.LI: {
      liEndTagInBody(p);
      break;
    }
    case TAG_ID.DD:
    case TAG_ID.DT: {
      ddEndTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderEndTagInBody(p);
      break;
    }
    case TAG_ID.BR: {
      brEndTagInBody(p);
      break;
    }
    case TAG_ID.BODY: {
      bodyEndTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlEndTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formEndTagInBody(p);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletEndTagInBody(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      genericEndTagInBody(p, token);
    }
  }
}
function eofInBody(p, token) {
  if (p.tmplInsertionModeStack.length > 0) {
    eofInTemplate(p, token);
  } else {
    stopParsing(p, token);
  }
}
function endTagInText(p, token) {
  var _a;
  if (token.tagID === TAG_ID.SCRIPT) {
    (_a = p.scriptHandler) === null || _a === void 0 ? void 0 : _a.call(p, p.openElements.current);
  }
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
}
function eofInText(p, token) {
  p._err(token, ERR.eofInElementThatCanContainOnlyText);
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
  p.onEof(token);
}
function characterInTable(p, token) {
  if (p.openElements.currentTagId !== void 0 && TABLE_STRUCTURE_TAGS.has(p.openElements.currentTagId)) {
    p.pendingCharacterTokens.length = 0;
    p.hasNonWhitespacePendingCharacterToken = false;
    p.originalInsertionMode = p.insertionMode;
    p.insertionMode = InsertionMode.IN_TABLE_TEXT;
    switch (token.type) {
      case TokenType.CHARACTER: {
        characterInTableText(p, token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        whitespaceCharacterInTableText(p, token);
        break;
      }
    }
  } else {
    tokenInTable(p, token);
  }
}
function captionStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p.activeFormattingElements.insertMarker();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_CAPTION;
}
function colgroupStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
}
function colStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.COLGROUP, TAG_ID.COLGROUP);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
  startTagInColumnGroup(p, token);
}
function tbodyStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
}
function tdStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.TBODY, TAG_ID.TBODY);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
  startTagInTableBody(p, token);
}
function tableStartTagInTable(p, token) {
  if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
    p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
    p._resetInsertionMode();
    p._processStartTag(token);
  }
}
function inputStartTagInTable(p, token) {
  if (isHiddenInput(token)) {
    p._appendElement(token, NS.HTML);
  } else {
    tokenInTable(p, token);
  }
  token.ackSelfClosing = true;
}
function formStartTagInTable(p, token) {
  if (!p.formElement && p.openElements.tmplCount === 0) {
    p._insertElement(token, NS.HTML);
    p.formElement = p.openElements.current;
    p.openElements.pop();
  }
}
function startTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      tdStartTagInTable(p, token);
      break;
    }
    case TAG_ID.STYLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      colStartTagInTable(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      tbodyStartTagInTable(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInTable(p, token);
      break;
    }
    case TAG_ID.CAPTION: {
      captionStartTagInTable(p, token);
      break;
    }
    case TAG_ID.COLGROUP: {
      colgroupStartTagInTable(p, token);
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function endTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function tokenInTable(p, token) {
  const savedFosterParentingState = p.fosterParentingEnabled;
  p.fosterParentingEnabled = true;
  modeInBody(p, token);
  p.fosterParentingEnabled = savedFosterParentingState;
}
function whitespaceCharacterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
}
function characterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
  p.hasNonWhitespacePendingCharacterToken = true;
}
function tokenInTableText(p, token) {
  let i2 = 0;
  if (p.hasNonWhitespacePendingCharacterToken) {
    for (; i2 < p.pendingCharacterTokens.length; i2++) {
      tokenInTable(p, p.pendingCharacterTokens[i2]);
    }
  } else {
    for (; i2 < p.pendingCharacterTokens.length; i2++) {
      p._insertCharacters(p.pendingCharacterTokens[i2]);
    }
  }
  p.insertionMode = p.originalInsertionMode;
  p._processToken(token);
}
var TABLE_VOID_ELEMENTS = /* @__PURE__ */ new Set([TAG_ID.CAPTION, TAG_ID.COL, TAG_ID.COLGROUP, TAG_ID.TBODY, TAG_ID.TD, TAG_ID.TFOOT, TAG_ID.TH, TAG_ID.THEAD, TAG_ID.TR]);
function startTagInCaption(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
      p.activeFormattingElements.clearToLastMarker();
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCaption(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.CAPTION:
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_TABLE;
        if (tn === TAG_ID.TABLE) {
          endTagInTable(p, token);
        }
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.COL: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function endTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.COLGROUP: {
      if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function tokenInColumnGroup(p, token) {
  if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
    p.openElements.pop();
    p.insertionMode = InsertionMode.IN_TABLE;
    p._processToken(token);
  }
}
function startTagInTableBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      p.openElements.clearBackToTableBodyContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_ROW;
      break;
    }
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableBodyContext();
      p._insertFakeElement(TAG_NAMES.TR, TAG_ID.TR);
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInTableBody(p, token) {
  const tn = token.tagID;
  switch (token.tagID) {
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        endTagInTable(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableRowContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_CELL;
      p.activeFormattingElements.insertMarker();
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        startTagInTableBody(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(token.tagID) || p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInCell(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.TD) || p.openElements.hasInTableScope(TAG_ID.TH)) {
      p._closeTableCell();
      startTagInRow(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCell(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.TD:
    case TAG_ID.TH: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(tn);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_ROW;
      }
      break;
    }
    case TAG_ID.TABLE:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(tn)) {
        p._closeTableCell();
        endTagInRow(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.OPTGROUP: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.HR: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.INPUT:
    case TAG_ID.KEYGEN:
    case TAG_ID.TEXTAREA:
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
        if (token.tagID !== TAG_ID.SELECT) {
          p._processStartTag(token);
        }
      }
      break;
    }
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.OPTGROUP: {
      if (p.openElements.stackTop > 0 && p.openElements.currentTagId === TAG_ID.OPTION && p.openElements.tagIDs[p.openElements.slotBelow(p.openElements.stackTop)] === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default:
  }
}
function startTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
    p._resetInsertionMode();
    p._processStartTag(token);
  } else {
    startTagInSelect(p, token);
  }
}
function endTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    if (p.openElements.hasInTableScope(tn)) {
      p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
      p._resetInsertionMode();
      p.onEndTag(token);
    }
  } else {
    endTagInSelect(p, token);
  }
}
function startTagInTemplate(p, token) {
  switch (token.tagID) {
    // First, handle tags that can start without a mode change
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      startTagInHead(p, token);
      break;
    }
    // Re-process the token in the appropriate mode
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      p.tmplInsertionModeStack[p.tmplInsertionModeStack.length - 1] = InsertionMode.IN_TABLE;
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
      break;
    }
    case TAG_ID.COL: {
      p.tmplInsertionModeStack[p.tmplInsertionModeStack.length - 1] = InsertionMode.IN_COLUMN_GROUP;
      p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
      startTagInColumnGroup(p, token);
      break;
    }
    case TAG_ID.TR: {
      p.tmplInsertionModeStack[p.tmplInsertionModeStack.length - 1] = InsertionMode.IN_TABLE_BODY;
      p.insertionMode = InsertionMode.IN_TABLE_BODY;
      startTagInTableBody(p, token);
      break;
    }
    case TAG_ID.TD:
    case TAG_ID.TH: {
      p.tmplInsertionModeStack[p.tmplInsertionModeStack.length - 1] = InsertionMode.IN_ROW;
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    default: {
      p.tmplInsertionModeStack[p.tmplInsertionModeStack.length - 1] = InsertionMode.IN_BODY;
      p.insertionMode = InsertionMode.IN_BODY;
      startTagInBody(p, token);
    }
  }
}
function endTagInTemplate(p, token) {
  if (token.tagID === TAG_ID.TEMPLATE) {
    templateEndTagInHead(p, token);
  }
}
function eofInTemplate(p, token) {
  if (p.openElements.tmplCount > 0) {
    do {
      p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
      p.activeFormattingElements.clearToLastMarker();
      p.tmplInsertionModeStack.pop();
    } while (p.openElements.tmplCount > 0);
    p._resetInsertionMode();
    p.onEof(token);
  } else {
    stopParsing(p, token);
  }
}
function startTagAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterBody(p, token);
  }
}
function endTagAfterBody(p, token) {
  var _a;
  if (token.tagID === TAG_ID.HTML) {
    if (!p.fragmentContext) {
      p.insertionMode = InsertionMode.AFTER_AFTER_BODY;
    }
    if (p.options.sourceCodeLocationInfo && p.openElements.tagIDs[0] === TAG_ID.HTML) {
      p._setEndLocation(p.openElements.items[0], token);
      const bodyElement = p.openElements.items[1];
      if (bodyElement && !((_a = p.treeAdapter.getNodeSourceCodeLocation(bodyElement)) === null || _a === void 0 ? void 0 : _a.endTag)) {
        p._setEndLocation(bodyElement, token);
      }
    }
  } else {
    tokenAfterBody(p, token);
  }
}
function tokenAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagInFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.FRAME: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInFrameset(p, token) {
  if (token.tagID === TAG_ID.FRAMESET && !p.openElements.isRootHtmlElementCurrent()) {
    p.openElements.pop();
    if (!p.fragmentContext && p.openElements.currentTagId !== TAG_ID.FRAMESET) {
      p.insertionMode = InsertionMode.AFTER_FRAMESET;
    }
  }
}
function startTagAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagAfterFrameset(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p.insertionMode = InsertionMode.AFTER_AFTER_FRAMESET;
  }
}
function startTagAfterAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterAfterBody(p, token);
  }
}
function tokenAfterAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagAfterAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function nullCharacterInForeignContent(p, token) {
  token.chars = REPLACEMENT_CHARACTER;
  p._insertCharacters(token);
}
function characterInForeignContent(p, token) {
  p._insertCharacters(token);
  p.framesetOk = false;
}
function popUntilHtmlOrIntegrationPoint(p) {
  while (p.treeAdapter.getNamespaceURI(p.openElements.current) !== NS.HTML && p.openElements.currentTagId !== void 0 && !p._isIntegrationPoint(p.openElements.currentTagId, p.openElements.current)) {
    p.openElements.pop();
  }
}
function startTagInForeignContent(p, token) {
  if (causesExit(token)) {
    popUntilHtmlOrIntegrationPoint(p);
    p._startTagOutsideForeignContent(token);
  } else {
    const current2 = p._getAdjustedCurrentElement();
    const currentNs = p.treeAdapter.getNamespaceURI(current2);
    if (currentNs === NS.MATHML) {
      adjustTokenMathMLAttrs(token);
    } else if (currentNs === NS.SVG) {
      adjustTokenSVGTagName(token);
      adjustTokenSVGAttrs(token);
    }
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, currentNs);
    } else {
      p._insertElement(token, currentNs);
    }
    token.ackSelfClosing = true;
  }
}
function endTagInForeignContent(p, token) {
  if (token.tagID === TAG_ID.P || token.tagID === TAG_ID.BR) {
    popUntilHtmlOrIntegrationPoint(p);
    p._endTagOutsideForeignContent(token);
    return;
  }
  if (p.openElements.stackTop === 0)
    return;
  const { tagName } = token;
  const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(tagName);
  const contextNs = p.fragmentContext ? p.treeAdapter.getNamespaceURI(p.fragmentContext) : NS.HTML;
  const i2 = Math.max(p.openElements.indexOfTopmostByName(NS.SVG, tagName), p.openElements.indexOfTopmostByName(NS.MATHML, tagName), adjustedTagName === void 0 ? -1 : p.openElements.indexOfTopmostByName(NS.SVG, adjustedTagName), contextNs === NS.HTML || contextNs === NS.SVG || contextNs === NS.MATHML ? -1 : p.openElements.indexOfTopmostByName(contextNs, tagName));
  if (i2 > p.openElements.indexOfTopmostHtmlElement()) {
    token.tagName = p.treeAdapter.getTagName(p.openElements.items[i2]);
    p.openElements.shortenToLength(i2);
  } else {
    p._endTagOutsideForeignContent(token);
  }
}

// node_modules/parse5/dist/serializer/index.js
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  TAG_NAMES.AREA,
  TAG_NAMES.BASE,
  TAG_NAMES.BASEFONT,
  TAG_NAMES.BGSOUND,
  TAG_NAMES.BR,
  TAG_NAMES.COL,
  TAG_NAMES.EMBED,
  TAG_NAMES.FRAME,
  TAG_NAMES.HR,
  TAG_NAMES.IMG,
  TAG_NAMES.INPUT,
  TAG_NAMES.KEYGEN,
  TAG_NAMES.LINK,
  TAG_NAMES.META,
  TAG_NAMES.PARAM,
  TAG_NAMES.SOURCE,
  TAG_NAMES.TRACK,
  TAG_NAMES.WBR
]);

// node_modules/parse5/dist/index.js
function parse(html, options) {
  return Parser.parse(html, options);
}
function parseFragment(fragmentContext, html, options) {
  if (typeof fragmentContext === "string") {
    options = html;
    html = fragmentContext;
    fragmentContext = null;
  }
  const parser = Parser.getFragmentParser(fragmentContext, options);
  parser.tokenizer.write(html, true);
  return parser.getFragment();
}

// src/engine/source.ts
var HTML_NS = "http://www.w3.org/1999/xhtml";
var SVG_NS = "http://www.w3.org/2000/svg";
var MATH_NS = "http://www.w3.org/1998/Math/MathML";
var VOID_TAGS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
  "basefont",
  "bgsound",
  "frame",
  "keygen",
  "param"
]);
var RAW_TEXT_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext"
]);
function isElement(n) {
  return n.tagName !== void 0;
}
function isText(n) {
  return n.nodeName === "#text";
}
function quoteOf(text, a) {
  const m = /^[^\s=]+\s*=\s*(["']?)/.exec(text.slice(a.start, a.end));
  return m ? m[1] : "";
}
function findAttr(n, name) {
  if (n.attrs[name]) return n.attrs[name];
  const lower = name.toLowerCase();
  const key = Object.keys(n.attrs).find((k) => k.toLowerCase() === lower);
  return key ? n.attrs[key] : void 0;
}
function classList(n) {
  return (findAttr(n, "class")?.value ?? "").split(/[ \t\n\r\f]+/).filter(Boolean);
}
function parseSource(text) {
  const bom = text.charCodeAt(0) === 65279;
  const shift = bom ? 1 : 0;
  const tree = parse(shift ? text.slice(1) : text, { sourceCodeLocationInfo: true });
  const nodes = [];
  const segments = [];
  const located = [];
  const visitText = (t, parent) => {
    const loc = t.sourceCodeLocation;
    if (!loc) return;
    segments.push({ nodeId: parent, rawStart: loc.startOffset + shift, rawEnd: loc.endOffset + shift, decoded: t.value, inPlace: false });
  };
  const visit = (el, parent, nearestLocated) => {
    const id = nodes.length;
    const loc = el.sourceCodeLocation;
    const ns = el.namespaceURI === SVG_NS ? "svg" : el.namespaceURI === MATH_NS ? "math" : "html";
    const node = {
      id,
      tag: el.tagName.toLowerCase(),
      start: -1,
      end: -1,
      startTagEnd: -1,
      endTagStart: null,
      attrs: {},
      patchable: false,
      parent,
      children: [],
      ns
    };
    nodes.push(node);
    if (parent !== null) nodes[parent].children.push(id);
    let myLocated = nearestLocated;
    if (loc && loc.startTag) {
      node.start = loc.startOffset + shift;
      node.end = loc.endOffset + shift;
      node.startTagEnd = loc.startTag.endOffset + shift;
      node.endTagStart = loc.endTag ? loc.endTag.startOffset + shift : null;
      for (const a of el.attrs) {
        const key = a.prefix ? `${a.prefix}:${a.name}` : a.name;
        const l = loc.attrs?.[key] ?? loc.attrs?.[key.toLowerCase()];
        if (!l) continue;
        const range = { start: l.startOffset + shift, end: l.endOffset + shift };
        node.attrs[key] = { ...range, value: a.value, quote: quoteOf(text, range) };
      }
      const foreign = el.namespaceURI !== HTML_NS;
      const selfClosing = text.slice(node.startTagEnd - 2, node.startTagEnd) === "/>" && !Object.values(node.attrs).some((a) => a.end > node.startTagEnd - 2);
      located.push({ node, foreign, selfClosing, domParentLocated: nearestLocated });
      myLocated = id;
    }
    const kids = [...el.childNodes ?? []];
    const content = el.content;
    if (content) kids.push(...content.childNodes);
    for (const c of kids) {
      if (isElement(c)) visit(c, id, myLocated);
      else if (isText(c)) visitText(c, id);
    }
  };
  for (const c of tree.childNodes) if (isElement(c)) visit(c, null, null);
  const startCount = /* @__PURE__ */ new Map();
  for (const l of located) startCount.set(l.node.start, (startCount.get(l.node.start) ?? 0) + 1);
  const bySource = [...located].sort((a, b) => a.node.start - b.node.start || b.node.end - a.node.end);
  const sourceParent = /* @__PURE__ */ new Map();
  const stack = [];
  for (const l of bySource) {
    while (stack.length && stack[stack.length - 1].end <= l.node.start) stack.pop();
    sourceParent.set(l.node.id, stack.length ? stack[stack.length - 1].id : null);
    stack.push(l.node);
  }
  for (const l of located) {
    const n = l.node;
    const realStart = text.slice(n.start, n.start + 1 + n.tag.length).toLowerCase() === "<" + n.tag;
    const closed = n.endTagStart !== null || VOID_TAGS.has(n.tag) || l.foreign && l.selfClosing;
    const unique = startCount.get(n.start) === 1;
    const inPlace = sourceParent.get(n.id) === l.domParentLocated;
    n.patchable = realStart && closed && unique && inPlace;
  }
  for (const s of segments) {
    const p = nodes[s.nodeId];
    const contentEnd = p.endTagStart ?? p.end;
    s.inPlace = p.start >= 0 && s.rawStart >= p.startTagEnd && s.rawEnd <= contentEnd && !p.children.some((c) => nodes[c].start >= 0 && nodes[c].start < s.rawEnd && s.rawStart < nodes[c].end);
  }
  const lastDesc = new Array(nodes.length);
  for (let i2 = nodes.length - 1; i2 >= 0; i2--) {
    const kids = nodes[i2].children;
    lastDesc[i2] = kids.length ? lastDesc[kids[kids.length - 1]] : i2;
  }
  return {
    text,
    bom,
    nodes,
    byId(id) {
      const n = Number.isInteger(id) ? nodes[id] : void 0;
      if (!n) throw new RangeError(`no source node with id ${id} (document has ${nodes.length} nodes)`);
      return n;
    },
    textSegments(id) {
      this.byId(id);
      const last = lastDesc[id];
      return segments.filter((s) => s.nodeId >= id && s.nodeId <= last);
    },
    query(q) {
      const [attrName, attrValue] = q.attr ? splitAttrQuery(q.attr) : [void 0, void 0];
      return nodes.filter((n) => {
        if (q.tag !== void 0 && n.tag !== q.tag.toLowerCase()) return false;
        if (q.cls !== void 0 && !classList(n).includes(q.cls)) return false;
        if (attrName !== void 0) {
          const a = findAttr(n, attrName);
          if (!a || attrValue !== void 0 && a.value !== attrValue) return false;
        }
        return true;
      });
    }
  };
}
function splitAttrQuery(s) {
  const i2 = s.indexOf("=");
  if (i2 < 0) return [s, void 0];
  return [s.slice(0, i2), s.slice(i2 + 1).replace(/^(["'])(.*)\1$/, "$2")];
}
function isWithin(doc, id, ancestor) {
  for (let p = id; p !== null; p = doc.nodes[p].parent) if (p === ancestor) return true;
  return false;
}
function lineIndent(text, offset2) {
  let i2 = offset2;
  while (i2 > 0 && (text[i2 - 1] === " " || text[i2 - 1] === "	")) i2--;
  if (i2 > 0 && text[i2 - 1] !== "\n") return null;
  return text.slice(i2, offset2);
}
function lineBreak(text) {
  const i2 = text.indexOf("\n");
  return i2 > 0 && text[i2 - 1] === "\r" ? "\r\n" : "\n";
}

// src/engine/html-text.ts
function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(value, quote) {
  const v = value.replace(/&(?=[#A-Za-z0-9])/g, "&amp;");
  return quote === '"' ? v.replace(/"/g, "&quot;") : v.replace(/'/g, "&#39;");
}
var UNQUOTED_SAFE = /^[^\s"'=<>`]+$/;
var decodeCache = /* @__PURE__ */ new Map();
function decodeReference(raw) {
  let v = decodeCache.get(raw);
  if (v === void 0) {
    const frag = parseFragment(`<b>${raw}</b>`);
    const b = frag.childNodes[0];
    v = (b.childNodes ?? []).map((c) => c.value ?? "").join("");
    decodeCache.set(raw, v);
  }
  return v;
}
var REF = /&(?:#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[A-Za-z][A-Za-z0-9]*;?)/y;
function textUnits(raw, rawStart, expected) {
  const units = [];
  let i2 = 0;
  while (i2 < raw.length) {
    const c = raw.charCodeAt(i2);
    if (c === 38) {
      REF.lastIndex = i2;
      const m = REF.exec(raw);
      if (m) {
        units.push({ rawStart: rawStart + i2, rawEnd: rawStart + i2 + m[0].length, decoded: decodeReference(m[0]) });
        i2 += m[0].length;
        continue;
      }
    }
    if (c === 13) {
      const n2 = raw.charCodeAt(i2 + 1) === 10 ? 2 : 1;
      units.push({ rawStart: rawStart + i2, rawEnd: rawStart + i2 + n2, decoded: "\n" });
      i2 += n2;
      continue;
    }
    const n = c >= 55296 && c <= 56319 && i2 + 1 < raw.length ? 2 : 1;
    units.push({ rawStart: rawStart + i2, rawEnd: rawStart + i2 + n, decoded: raw.slice(i2, i2 + n) });
    i2 += n;
  }
  if (units.map((u) => u.decoded).join("") !== expected) {
    return raw.length ? [{ rawStart, rawEnd: rawStart + raw.length, decoded: expected }] : [];
  }
  return units;
}
function isCollapsible(ch) {
  return ch === " " || ch === "	" || ch === "\n" || ch === "\r" || ch === "\f";
}
function normaliseVisible(s) {
  return s.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[ \t\f\r]+/g, " ").replace(/^ | $/g, "")).join("\n");
}

// src/engine/errors.ts
var OpError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "OpError";
    this.code = code;
  }
};

// src/engine/attrs.ts
function requireNode(doc, id) {
  if (!Number.isInteger(id) || id < 0 || id >= doc.nodes.length) {
    throw new OpError("not-found", `no node with id ${id} (document has ${doc.nodes.length} nodes)`);
  }
  return doc.nodes[id];
}
function requirePatchable(doc, id) {
  const n = requireNode(doc, id);
  if (!n.patchable) throw new OpError("unpatchable", `node ${id} <${n.tag}> is not patchable (its source is not where the DOM puts it)`);
  return n;
}
function attrValueRange(text, a) {
  const m = /^[^\s=]+\s*=\s*(["']?)/.exec(text.slice(a.start, a.end));
  if (!m) return null;
  const vStart = a.start + m[0].length;
  return { vStart, vEnd: a.quote ? a.end - 1 : a.end };
}
function rawEqualsDecoded(text, a) {
  const r = attrValueRange(text, a);
  return r !== null && text.slice(r.vStart, r.vEnd) === a.value;
}
function isSelfClosing(text, n) {
  return text.slice(n.startTagEnd - 2, n.startTagEnd) === "/>" && !Object.values(n.attrs).some((x) => x.end > n.startTagEnd - 2);
}
function setAttrSplices(doc, n, name, value) {
  const text = doc.text;
  const a = findAttr(n, name);
  if (value === null) {
    if (!a) return [];
    let s = a.start;
    while (s > n.start && /\s/.test(text[s - 1])) s--;
    return [{ start: s, end: a.end, text: "" }];
  }
  if (!/^[^\s"'>/=\0]+$/.test(name)) throw new OpError("invalid", `invalid attribute name ${JSON.stringify(name)}`);
  if (!a) {
    const at2 = isSelfClosing(text, n) ? n.startTagEnd - 2 : n.startTagEnd - 1;
    return [{ start: at2, end: at2, text: ` ${name}="${escapeAttr(value, '"')}"` }];
  }
  if (a.value === value) return [];
  const raw = text.slice(a.start, a.end);
  const m = /^([^\s=]+\s*=\s*)(["']?)/.exec(raw);
  if (!m) return [{ start: a.start, end: a.end, text: `${raw}="${escapeAttr(value, '"')}"` }];
  const head = m[1];
  const q = m[2];
  let out2;
  if (q) out2 = head + q + escapeAttr(value, q) + q;
  else if (UNQUOTED_SAFE.test(value)) out2 = head + value.replace(/&(?=[#A-Za-z0-9])/g, "&amp;");
  else out2 = head + '"' + escapeAttr(value, '"') + '"';
  return out2 === raw ? [] : [{ start: a.start, end: a.end, text: out2 }];
}

// src/engine/class-algebra.ts
var GROUPS = [
  "top",
  "right",
  "bottom",
  "left",
  "translate-x",
  "translate-y",
  "rotate",
  "width",
  "height",
  "font-size",
  "text-color",
  "bg-color",
  "font-weight",
  "font-family",
  "leading",
  "tracking",
  "opacity",
  "z",
  "pt",
  "pr",
  "pb",
  "pl",
  "mt",
  "mr",
  "mb",
  "ml",
  "gap",
  "rounded",
  "text-align",
  "position"
];
var DEFAULT_SIZES = /* @__PURE__ */ new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]);
var DEFAULT_FAMILIES = /* @__PURE__ */ new Set(["sans", "serif", "mono"]);
var WEIGHTS = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900
};
var WEIGHT_NAMES = Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [v, k]));
var COLOR_KEYWORDS = /* @__PURE__ */ new Set(["inherit", "current", "transparent", "black", "white"]);
var PALETTE = /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/;
var ALIGN = /* @__PURE__ */ new Set(["left", "right", "center", "justify", "start", "end"]);
var POSITION = /* @__PURE__ */ new Set(["static", "fixed", "absolute", "relative", "sticky"]);
var ROUNDED_SIDES = /^(t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee)(-|$)/;
var PREFIX = {
  top: "top",
  right: "right",
  bottom: "bottom",
  left: "left",
  "translate-x": "translate-x",
  "translate-y": "translate-y",
  rotate: "rotate",
  width: "w",
  height: "h",
  "font-size": "text",
  "text-color": "text",
  "bg-color": "bg",
  "font-weight": "font",
  "font-family": "font",
  leading: "leading",
  tracking: "tracking",
  opacity: "opacity",
  z: "z",
  pt: "pt",
  pr: "pr",
  pb: "pb",
  pl: "pl",
  mt: "mt",
  mr: "mr",
  mb: "mb",
  ml: "ml",
  gap: "gap",
  rounded: "rounded",
  "text-align": "text",
  position: ""
};
function splitVariants(raw) {
  const parts = [];
  let depth = 0;
  let last = 0;
  for (let i2 = 0; i2 < raw.length; i2++) {
    const c = raw[i2];
    if (c === "[" || c === "(") depth++;
    else if ((c === "]" || c === ")") && depth > 0) depth--;
    else if (c === ":" && depth === 0) {
      parts.push(raw.slice(last, i2));
      last = i2 + 1;
    }
  }
  parts.push(raw.slice(last));
  return parts;
}
function isKnownColor(name, ctx) {
  const base = name.replace(/\/[^/]+$/, "");
  return ctx.colors.has(base) || COLOR_KEYWORDS.has(base) || PALETTE.test(base);
}
function arbitraryKind(v) {
  const inner = v.slice(1, -1);
  if (/^length:/.test(inner)) return "length";
  if (/^color:/.test(inner)) return "color";
  if (/^#[0-9a-fA-F]{3,8}$/.test(inner) || /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(inner) || /^var\(/.test(inner)) return "color";
  if (/^-?\d*\.?\d+$/.test(inner)) return "number";
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|cm|mm|in|pc|lh|svh|dvh|lvh)$/.test(inner) || /^(calc|clamp|min|max)\(/.test(inner)) return "length";
  return "other";
}
function classify(body, ctx) {
  if (POSITION.has(body)) return { utility: body, value: null, group: "position" };
  let m;
  if (m = /^(top|right|bottom|left)-(.+)$/.exec(body)) return { utility: m[1], value: m[2], group: m[1] };
  if (m = /^translate-([xy])-(.+)$/.exec(body)) return { utility: `translate-${m[1]}`, value: m[2], group: `translate-${m[1]}` };
  if (m = /^rotate-(.+)$/.exec(body)) return { utility: "rotate", value: m[1], group: "rotate" };
  if (m = /^w-(.+)$/.exec(body)) return { utility: "w", value: m[1], group: "width" };
  if (m = /^h-(.+)$/.exec(body)) return { utility: "h", value: m[1], group: "height" };
  if (m = /^text-(.+)$/.exec(body)) {
    const v = m[1];
    if (ALIGN.has(v)) return { utility: "text", value: v, group: "text-align" };
    if (v.startsWith("[")) {
      const k = arbitraryKind(v);
      if (k === "length") return { utility: "text", value: v, group: "font-size" };
      if (k === "color") return { utility: "text", value: v, group: "text-color" };
      return { utility: "text", value: v, group: null };
    }
    const size = v.replace(/\/.+$/, "");
    if (DEFAULT_SIZES.has(size) || ctx.fontSizes.has(size)) return { utility: "text", value: v, group: "font-size" };
    if (isKnownColor(v, ctx)) return { utility: "text", value: v, group: "text-color" };
    return { utility: "text", value: v, group: null };
  }
  if (m = /^bg-(.+)$/.exec(body)) {
    const v = m[1];
    if (v.startsWith("[")) return { utility: "bg", value: v, group: arbitraryKind(v) === "color" ? "bg-color" : null };
    return { utility: "bg", value: v, group: isKnownColor(v, ctx) ? "bg-color" : null };
  }
  if (m = /^font-(.+)$/.exec(body)) {
    const v = m[1];
    if (v in WEIGHTS) return { utility: "font", value: v, group: "font-weight" };
    if (DEFAULT_FAMILIES.has(v) || ctx.fontFamilies.has(v)) return { utility: "font", value: v, group: "font-family" };
    if (v.startsWith("[")) return { utility: "font", value: v, group: arbitraryKind(v) === "number" ? "font-weight" : "font-family" };
    return { utility: "font", value: v, group: null };
  }
  if (m = /^(leading|tracking|opacity|z|gap)-(.+)$/.exec(body)) {
    return { utility: m[1], value: m[2], group: m[1] };
  }
  if (m = /^([pm])([trbl])-(.+)$/.exec(body)) return { utility: m[1] + m[2], value: m[3], group: m[1] + m[2] };
  if (body === "rounded") return { utility: "rounded", value: null, group: "rounded" };
  if (m = /^rounded-(.+)$/.exec(body)) {
    if (ROUNDED_SIDES.test(m[1])) return { utility: "rounded", value: m[1], group: null };
    return { utility: "rounded", value: m[1], group: "rounded" };
  }
  const dash = body.indexOf("-");
  return dash > 0 ? { utility: body.slice(0, dash), value: body.slice(dash + 1), group: null } : { utility: body, value: null, group: null };
}
function parseToken(raw, ctx) {
  const parts = splitVariants(raw);
  let body = parts.pop();
  let important = false;
  if (body.startsWith("!")) {
    important = true;
    body = body.slice(1);
  } else if (body.endsWith("!") && body.length > 1) {
    important = true;
    body = body.slice(0, -1);
  }
  let negative = false;
  if (body.startsWith("-") && body.length > 1) {
    negative = true;
    body = body.slice(1);
  }
  const c = classify(body, ctx);
  return { raw, variants: parts, important, negative, ...c };
}
var isBase = (t) => t.variants.length === 0 && !t.important;
var LENGTH_GROUPS = /* @__PURE__ */ new Set([
  "top",
  "right",
  "bottom",
  "left",
  "translate-x",
  "translate-y",
  "width",
  "height",
  "font-size",
  "pt",
  "pr",
  "pb",
  "pl",
  "mt",
  "mr",
  "mb",
  "ml",
  "gap",
  "rounded"
]);
var NUMERIC = /^-?\d*\.?\d+$/;
var PX = /^(-?\d*\.?\d+)px$/;
var KEYWORD = /^[A-Za-z0-9][\w./-]*$/;
function arbitrary(v) {
  return `[${v.trim().replace(/\s+/g, "_")}]`;
}
function hexColor(v) {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(v.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  return `#${h}`;
}
function formatUtility(group, value, ctx) {
  const v = value.trim();
  if (v === "") throw new OpError("invalid", `empty value for ${group}`);
  const prefix = PREFIX[group];
  const tok = (suffix) => `${prefix}-${suffix}`;
  if (group === "position") {
    if (!POSITION.has(v)) throw new OpError("invalid", `position must be one of ${[...POSITION].join(", ")}, got ${JSON.stringify(v)}`);
    return v;
  }
  if (group === "text-align") {
    if (!ALIGN.has(v)) throw new OpError("invalid", `text-align must be one of ${[...ALIGN].join(", ")}, got ${JSON.stringify(v)}`);
    return tok(v);
  }
  if (v.startsWith("[") && v.endsWith("]")) return tok(v);
  if (group === "text-color" || group === "bg-color") {
    if (isKnownColor(v, ctx)) return tok(v);
    const hex = hexColor(v);
    if (hex) return tok(`[${hex}]`);
    if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|var)\(/.test(v)) return tok(arbitrary(v));
    throw new OpError("invalid", `unknown colour ${JSON.stringify(v)} for ${group}`);
  }
  if (group === "font-weight") {
    if (v in WEIGHTS) return tok(v);
    if (NUMERIC.test(v)) {
      const n = Number(v);
      return WEIGHT_NAMES[n] ? tok(WEIGHT_NAMES[n]) : tok(`[${Math.round(n)}]`);
    }
    throw new OpError("invalid", `invalid font weight ${JSON.stringify(v)}`);
  }
  if (group === "font-family") {
    if (DEFAULT_FAMILIES.has(v) || ctx.fontFamilies.has(v)) return tok(v);
    return tok(`['${v.replace(/^['"]|['"]$/g, "").replace(/\s+/g, "_")}']`);
  }
  if (group === "rotate") {
    const m = /^(-?\d*\.?\d+)(deg)?$/.exec(v);
    if (m) return tok(`[${Number(Number(m[1]).toFixed(2))}deg]`);
    if (KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (group === "opacity") {
    if (NUMERIC.test(v)) {
      const n = Number(v);
      if (n <= 1 && v.includes(".")) return tok(`[${n}]`);
      if (Number.isInteger(n) && n % 5 === 0 && n >= 0 && n <= 100) return tok(String(n));
      return tok(`[${n}%]`);
    }
    if (/^\d+%$/.test(v)) return tok(`[${v}]`);
    throw new OpError("invalid", `invalid opacity ${JSON.stringify(v)}`);
  }
  if (group === "z") {
    if (v === "auto") return tok(v);
    if (/^-?\d+$/.test(v)) return ["0", "10", "20", "30", "40", "50"].includes(v) ? tok(v) : tok(`[${v}]`);
    throw new OpError("invalid", `invalid z-index ${JSON.stringify(v)}`);
  }
  if (group === "leading") {
    if (NUMERIC.test(v)) return tok(`[${Number(v)}]`);
    const px = PX.exec(v);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (group === "tracking") {
    const px = PX.exec(v) ?? (NUMERIC.test(v) ? [v, v] : null);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (["tighter", "tight", "normal", "wide", "wider", "widest"].includes(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (LENGTH_GROUPS.has(group)) {
    const px = PX.exec(v) ?? (NUMERIC.test(v) ? [v, v] : null);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (group === "font-size" && (DEFAULT_SIZES.has(v) || ctx.fontSizes.has(v))) return tok(v);
    if (group !== "font-size" && KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  throw new OpError("unsupported", `cannot format a value for ${group}`);
}
function setUtility(classes, group, value, ctx) {
  const next = value === null ? null : formatUtility(group, value, ctx);
  const out2 = [];
  let placed = false;
  for (const c of classes) {
    const t = parseToken(c, ctx);
    if (t.group === group && isBase(t)) {
      if (next !== null && !placed) out2.push(next);
      placed = true;
      continue;
    }
    out2.push(c);
  }
  if (next !== null && !placed) out2.push(next);
  return out2;
}
function setClassAttr(doc, id, classes) {
  const n = requirePatchable(doc, id);
  for (const c of classes) {
    if (!c || /[\s]/.test(c)) throw new OpError("invalid", `invalid class token ${JSON.stringify(c)}`);
  }
  const text = doc.text;
  const a = findAttr(n, "class");
  if (!a) return classes.length ? setAttrSplices(doc, n, "class", classes.join(" ")) : [];
  const oldTokens = a.value.split(/[ \t\n\r\f]+/).filter(Boolean);
  if (oldTokens.length === classes.length && oldTokens.every((t, i2) => t === classes[i2])) return [];
  if (classes.length === 0) return setAttrSplices(doc, n, "class", null);
  const range = attrValueRange(text, a);
  const needsQuotes = a.quote === "" && (classes.length > 1 || !classes.every((c) => UNQUOTED_SAFE.test(c)));
  if (!range || !rawEqualsDecoded(text, a) || needsQuotes || oldTokens.length === 0) {
    return setAttrSplices(doc, n, "class", classes.join(" "));
  }
  const q = a.quote === "'" ? "'" : '"';
  const esc2 = (t) => a.quote ? escapeAttr(t, q) : t;
  const raw = [];
  const re = /[^ \t\n\r\f]+/g;
  const value = text.slice(range.vStart, range.vEnd);
  for (let m = re.exec(value); m; m = re.exec(value)) raw.push({ tok: m[0], s: range.vStart + m.index, e: range.vStart + m.index + m[0].length });
  let p = 0;
  while (p < raw.length && p < classes.length && raw[p].tok === classes[p]) p++;
  let q2 = 0;
  while (q2 < raw.length - p && q2 < classes.length - p && raw[raw.length - 1 - q2].tok === classes[classes.length - 1 - q2]) q2++;
  const oldMid = raw.slice(p, raw.length - q2);
  const newMid = classes.slice(p, classes.length - q2);
  if (oldMid.length === newMid.length) {
    return oldMid.filter((t, i2) => t.tok !== newMid[i2]).map((t) => ({ start: t.s, end: t.e, text: esc2(newMid[oldMid.indexOf(t)]) }));
  }
  if (oldMid.length === 0) {
    const ins = newMid.map(esc2).join(" ");
    if (p > 0) return [{ start: raw[p - 1].e, end: raw[p - 1].e, text: " " + ins }];
    return [{ start: raw[0].s, end: raw[0].s, text: ins + " " }];
  }
  const s = oldMid[0].s;
  const e = oldMid[oldMid.length - 1].e;
  if (newMid.length === 0) {
    if (p > 0) return [{ start: raw[p - 1].e, end: e, text: "" }];
    const after = raw[p + oldMid.length];
    return [{ start: s, end: after ? after.s : range.vEnd, text: "" }];
  }
  return [{ start: s, end: e, text: newMid.map(esc2).join(" ") }];
}

// src/engine/text-diff.ts
var HIDDEN_TAGS = /* @__PURE__ */ new Set([...RAW_TEXT_TAGS, "template"]);
var NON_TEXT = /* @__PURE__ */ new Set([
  "img",
  "svg",
  "math",
  "video",
  "audio",
  "canvas",
  "iframe",
  "object",
  "embed",
  "picture",
  "input",
  "select",
  "textarea",
  "button",
  "hr",
  "meter",
  "progress"
]);
function isHiddenWithin(doc, id, root) {
  for (let p = id; p !== null && p !== root; p = doc.nodes[p].parent) if (HIDDEN_TAGS.has(doc.nodes[p].tag)) return true;
  return false;
}
function requireTextTarget(doc, id) {
  const n = requirePatchable(doc, id);
  if (RAW_TEXT_TAGS.has(n.tag) || n.tag === "template") throw new OpError("unsupported", `node ${id} <${n.tag}> is a raw-text element; its text is not editable as text`);
  if (VOID_TAGS.has(n.tag) || n.endTagStart === null) throw new OpError("invalid", `node ${id} <${n.tag}> has no content`);
  return n;
}
function visibleChars(doc, root) {
  const segs = doc.textSegments(root.id).filter((s) => !isHiddenWithin(doc, s.nodeId, root.id));
  for (const s of segs) {
    if (!s.inPlace || !doc.nodes[s.nodeId].patchable) {
      throw new OpError("unpatchable", `text inside node ${s.nodeId} <${doc.nodes[s.nodeId].tag}> is not where the DOM puts it`);
    }
  }
  const brs = [];
  const last = root.id + countDescendants(doc, root);
  for (let i2 = root.id + 1; i2 <= last; i2++) {
    if (doc.nodes[i2].tag === "br" && !isHiddenWithin(doc, i2, root.id)) brs.push(doc.nodes[i2]);
  }
  const items = [...segs.map((seg) => ({ at: seg.rawStart, seg })), ...brs.map((br) => ({ at: br.start, br }))];
  items.sort((x, y) => x.at - y.at);
  const out2 = [];
  let unitId = 0;
  let pending = null;
  let lastBr = null;
  let lineStart = true;
  const pendingRanges = () => pending ? [{ start: pending.rawStart, end: pending.rawEnd }, ...pending.extra] : [];
  items.forEach((item, segIndex) => {
    if (item.br) {
      const br = {
        ch: "\n",
        rawStart: item.br.start,
        rawEnd: item.br.end,
        nodeId: item.br.id,
        unit: unitId++,
        br: true,
        extra: lineStart ? [] : pendingRanges()
      };
      if (lineStart && lastBr) lastBr.extra.push(...pendingRanges());
      pending = null;
      out2.push(br);
      lastBr = br;
      lineStart = true;
      return;
    }
    const seg = item.seg;
    for (const u of textUnits(doc.text.slice(seg.rawStart, seg.rawEnd), seg.rawStart, seg.decoded)) {
      if ([...u.decoded].every(isCollapsible)) {
        if (!pending) pending = { rawStart: u.rawStart, rawEnd: u.rawEnd, nodeId: seg.nodeId, seg: segIndex, extra: [] };
        else if (pending.seg === segIndex && pending.rawEnd === u.rawStart) pending.rawEnd = u.rawEnd;
        else {
          const last2 = pending.extra[pending.extra.length - 1];
          if (last2 && last2.end === u.rawStart) last2.end = u.rawEnd;
          else pending.extra.push({ start: u.rawStart, end: u.rawEnd });
        }
        continue;
      }
      if (pending && !lineStart) {
        out2.push({ ch: " ", rawStart: pending.rawStart, rawEnd: pending.rawEnd, nodeId: pending.nodeId, unit: unitId++, br: false, extra: pending.extra });
      } else if (pending && lastBr) {
        lastBr.extra.push(...pendingRanges());
      }
      pending = null;
      const id = unitId++;
      for (let i2 = 0; i2 < u.decoded.length; i2++) {
        out2.push({ ch: u.decoded[i2], rawStart: u.rawStart, rawEnd: u.rawEnd, nodeId: seg.nodeId, unit: id, br: false, extra: [] });
      }
      lineStart = false;
      lastBr = null;
    }
  });
  return out2;
}
function countDescendants(doc, n) {
  let count = 0;
  const stack = [...n.children];
  while (stack.length) {
    const c = stack.pop();
    count++;
    stack.push(...doc.nodes[c].children);
  }
  return count;
}
function visibleText(doc, id) {
  const n = requireTextTarget(doc, id);
  return visibleChars(doc, n).map((v) => v.ch).join("");
}
function escapeInserted(s) {
  return escapeText(s).replace(/\n/g, "<br>");
}
function elementCoverage(doc, root, chars) {
  const cover = /* @__PURE__ */ new Map();
  chars.forEach((c, i2) => {
    for (let p = c.nodeId; p !== null && p !== root.id; p = doc.nodes[p].parent) {
      const r = cover.get(p);
      if (r) r.last = i2;
      else cover.set(p, { first: i2, last: i2 });
    }
  });
  return cover;
}
function hasNonTextContent(doc, n) {
  const stack = [...n.children];
  while (stack.length) {
    const c = doc.nodes[stack.pop()];
    if (NON_TEXT.has(c.tag) || c.ns !== "html" || VOID_TAGS.has(c.tag) && c.tag !== "br") return true;
    stack.push(...c.children);
  }
  return false;
}
function within(doc, id, ancestor) {
  for (let p = id; p !== null; p = doc.nodes[p].parent) if (p === ancestor) return true;
  return false;
}
function setText(doc, id, next) {
  const root = requireTextTarget(doc, id);
  const chars = visibleChars(doc, root);
  const want = normaliseVisible(next);
  const have = chars.map((c) => c.ch).join("");
  if (have === want) return [];
  let a = 0;
  while (a < have.length && a < want.length && have[a] === want[a]) a++;
  let s = 0;
  while (s < have.length - a && s < want.length - a && have[have.length - 1 - s] === want[want.length - 1 - s]) s++;
  let b = have.length - s;
  while (a > 0 && a < chars.length && chars[a - 1].unit === chars[a].unit) a--;
  while (b > 0 && b < chars.length && chars[b - 1].unit === chars[b].unit) b++;
  const inserted = want.slice(a, want.length - (have.length - b));
  if (a === b) {
    let at2;
    const left = a > 0 ? chars[a - 1] : null;
    const right = a < chars.length ? chars[a] : null;
    const hidden = left !== null && right !== null && left.extra.some((r) => r.start >= left.rawEnd && r.end <= right.rawStart);
    if (left && !hidden) at2 = left.rawEnd;
    else if (right) at2 = right.rawStart;
    else if (left) at2 = left.rawEnd;
    else at2 = root.startTagEnd;
    return [{ start: at2, end: at2, text: escapeInserted(inserted) }];
  }
  const insertInto = inserted ? chars[a].nodeId : -1;
  const cover = elementCoverage(doc, root, chars);
  const removed = [];
  for (const [eid, r] of cover) {
    if (r.first < a || r.last >= b) continue;
    const e = doc.nodes[eid];
    if (!e.patchable || e.tag === "br" || hasNonTextContent(doc, e)) continue;
    if (insertInto >= 0 && within(doc, insertInto, eid)) continue;
    removed.push(e);
  }
  const outer = removed.filter((e) => !removed.some((o) => o !== e && within(doc, e.id, o.id)));
  const ranges = outer.map((e) => ({ start: e.start, end: e.end }));
  for (let i2 = a; i2 < b; i2++) {
    const c = chars[i2];
    for (const r of [{ start: c.rawStart, end: c.rawEnd }, ...c.extra]) {
      if (outer.some((e) => r.start >= e.start && r.end <= e.end)) continue;
      ranges.push(r);
    }
  }
  ranges.sort((x, y) => x.start - y.start || y.end - x.end);
  const merged = [];
  for (const r of ranges) {
    const top = merged[merged.length - 1];
    if (top && r.start <= top.end) top.end = Math.max(top.end, r.end);
    else merged.push({ ...r });
  }
  const splices = merged.map((r) => ({ ...r, text: "" }));
  if (inserted) {
    const at2 = chars[a].rawStart;
    const host = splices.find((sp) => sp.start <= at2 && at2 < sp.end);
    if (host) host.text = escapeInserted(inserted);
    else splices.push({ start: at2, end: at2, text: escapeInserted(inserted) });
  }
  return splices;
}

// src/engine/ops-structure.ts
var ROOT_TAGS = /* @__PURE__ */ new Set(["html", "head", "body"]);
var PREFORMATTED = /<(pre|textarea|script|style)\b|whitespace-pre/i;
function requireMovable(doc, id) {
  const n = requirePatchable(doc, id);
  if (ROOT_TAGS.has(n.tag)) throw new OpError("invalid", `<${n.tag}> cannot be removed, moved, duplicated or wrapped`);
  return n;
}
function requireContainer(doc, id) {
  const p = requirePatchable(doc, id);
  if (p.endTagStart === null) throw new OpError("invalid", `node ${id} <${p.tag}> cannot have children`);
  return p;
}
function reindent(fragment, from, to) {
  if (from === null || to === null || from === to || PREFORMATTED.test(fragment)) return fragment;
  const lines = fragment.split("\n");
  return lines.map((line, i2) => {
    if (i2 === 0 || /^[ \t]*\r?$/.test(line)) return line;
    return line.startsWith(from) ? to + line.slice(from.length) : line;
  }).join("\n");
}
function insertAt(doc, parent, index, fragment, fragmentIndent, exclude) {
  const text = doc.text;
  const nl = lineBreak(text);
  const siblings = parent.children.filter((c) => c !== exclude && doc.nodes[c].start >= 0).map((c) => doc.nodes[c]);
  if (!Number.isInteger(index) || index < 0 || index > siblings.length) {
    throw new OpError("invalid", `index ${index} is out of range for <${parent.tag}> (node ${parent.id}) with ${siblings.length} element children`);
  }
  if (index < siblings.length) {
    const sib = siblings[index];
    const ind2 = lineIndent(text, sib.start);
    if (ind2 === null) return { start: sib.start, end: sib.start, text: fragment };
    return { start: sib.start, end: sib.start, text: reindent(fragment, fragmentIndent, ind2) + nl + ind2 };
  }
  if (siblings.length) {
    const last = siblings[siblings.length - 1];
    const ind2 = lineIndent(text, last.start);
    if (ind2 === null) return { start: last.end, end: last.end, text: fragment };
    return { start: last.end, end: last.end, text: nl + ind2 + reindent(fragment, fragmentIndent, ind2) };
  }
  const close = parent.endTagStart;
  const ind = lineIndent(text, close);
  const content = text.slice(parent.startTagEnd, close);
  if (ind === null || content.trim() !== "") return { start: close, end: close, text: fragment };
  const inner = ind + "  ";
  const at2 = close - ind.length;
  return { start: at2, end: at2, text: inner + reindent(fragment, fragmentIndent, inner) + nl };
}
function insertHtmlSplices(doc, parentId, index, html) {
  const parent = requireContainer(doc, parentId);
  if (typeof html !== "string" || html.trim() === "") throw new OpError("invalid", "insertHtml needs non-empty html");
  return [insertAt(doc, parent, index, html.replace(/\r\n?/g, lineBreak(doc.text)), "")];
}
function removalRange(text, n) {
  const ind = lineIndent(text, n.start);
  const after = /^[ \t]*/.exec(text.slice(n.end))[0];
  if (ind !== null) {
    const rest = /^[ \t]*(\r?\n|$)/.exec(text.slice(n.end));
    if (rest && n.start - ind.length > 0) {
      const start = n.start - ind.length;
      let end = n.end + rest[0].length;
      const blankBefore = /\n[ \t]*\r?\n$/.test(text.slice(Math.max(0, start - 200), start));
      const blankAfter = /^[ \t]*\r?\n/.exec(text.slice(end));
      if (blankBefore && blankAfter) end += blankAfter[0].length;
      return { start, end };
    }
    return { start: n.start, end: n.end + after.length };
  }
  let pre = 0;
  while (n.start - pre > 0 && (text[n.start - pre - 1] === " " || text[n.start - pre - 1] === "	")) pre++;
  if (pre > 0 && after.length > 0) return { start: n.start - pre, end: n.end };
  return { start: n.start, end: n.end };
}
function removeSplices(doc, id) {
  const n = requireMovable(doc, id);
  return [{ ...removalRange(doc.text, n), text: "" }];
}
function moveSplices(doc, id, parentId, index) {
  const n = requireMovable(doc, id);
  const parent = requireContainer(doc, parentId);
  if (isWithin(doc, parentId, id)) throw new OpError("invalid", `cannot move node ${id} into itself or its descendant ${parentId}`);
  const current2 = n.parent === parentId ? parent.children.filter((c) => doc.nodes[c].start >= 0).indexOf(id) : -1;
  if (current2 === index) return [];
  const text = doc.text;
  const removal = { ...removalRange(text, n), text: "" };
  const fragment = text.slice(n.start, n.end);
  const insertion = insertAt(doc, parent, index, fragment, lineIndent(text, n.start), id);
  try {
    checkSplices(text.length, [removal, insertion]);
  } catch {
    throw new OpError("invalid", `cannot move node ${id} to index ${index} of node ${parentId}: the target lies inside the removed range`);
  }
  return [removal, insertion];
}
var ID_LIST_ATTRS = ["for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "aria-flowto", "aria-details", "aria-errormessage"];
var HREF_ATTRS = ["href", "xlink:href"];
function uniqueName(base, taken) {
  for (let i2 = 2; ; i2++) {
    const c = `${base}-${i2}`;
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
}
function subtree(doc, n) {
  const out2 = [];
  const stack = [n.id];
  while (stack.length) {
    const c = doc.nodes[stack.pop()];
    out2.push(c);
    stack.push(...c.children);
  }
  return out2;
}
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function renamedCopy(doc, n) {
  const text = doc.text;
  const nodes = subtree(doc, n);
  const allIds = new Set(doc.nodes.map((x) => findAttr(x, "id")?.value).filter((v) => !!v));
  const allMorph = new Set(doc.nodes.map((x) => findAttr(x, "data-morph")?.value).filter((v) => !!v));
  const ids = /* @__PURE__ */ new Map();
  const morphs = /* @__PURE__ */ new Map();
  for (const x of nodes) {
    const v = findAttr(x, "id")?.value;
    if (v && !ids.has(v)) ids.set(v, uniqueName(v, allIds));
    const m = findAttr(x, "data-morph")?.value;
    if (m && !morphs.has(m)) morphs.set(m, uniqueName(m, allMorph));
  }
  const urlRe = ids.size ? new RegExp(`url\\(\\s*(['"]?)#(${[...ids.keys()].map(escapeRe).join("|")})\\1\\s*\\)`, "g") : null;
  const renameUrls = (s) => urlRe ? s.replace(urlRe, (_m, q, id) => `url(${q}#${ids.get(id)}${q})`) : s;
  const splices = [];
  for (const x of nodes) {
    if (x.start < 0) continue;
    for (const [name, a] of Object.entries(x.attrs)) {
      const lname = name.toLowerCase();
      let next = a.value;
      if (lname === "id") next = ids.get(a.value) ?? a.value;
      else if (lname === "data-morph") next = morphs.get(a.value) ?? a.value;
      else if (ID_LIST_ATTRS.includes(lname)) next = a.value.split(/(\s+)/).map((t) => ids.get(t) ?? t).join("");
      else if (HREF_ATTRS.includes(lname) && a.value.startsWith("#") && ids.has(a.value.slice(1))) next = "#" + ids.get(a.value.slice(1));
      else next = renameUrls(a.value);
      if (next !== a.value) splices.push(...setAttrSplices(doc, x, name, next));
    }
    if (x.tag === "style" && x.endTagStart !== null) {
      const css = text.slice(x.startTagEnd, x.endTagStart);
      const next = renameUrls(css);
      if (next !== css) splices.push({ start: x.startTagEnd, end: x.endTagStart, text: next });
    }
  }
  const shifted = splices.map((s) => ({ start: s.start - n.start, end: s.end - n.start, text: s.text }));
  return applySplices(text.slice(n.start, n.end), shifted);
}
function duplicateSplices(doc, id) {
  const n = requireMovable(doc, id);
  const text = doc.text;
  const copy = renamedCopy(doc, n);
  const ind = lineIndent(text, n.start);
  return [{ start: n.end, end: n.end, text: ind === null ? copy : lineBreak(text) + ind + copy }];
}
var EMPTY_ELEMENT = /^\s*<([A-Za-z][\w:-]*)(\s[^<>]*)?>\s*<\/\1\s*>\s*$/;
function wrapSplices(doc, ids, html) {
  if (!Array.isArray(ids) || ids.length === 0) throw new OpError("invalid", "wrap needs at least one node id");
  const m = typeof html === "string" ? EMPTY_ELEMENT.exec(html) : null;
  if (!m) throw new OpError("invalid", `wrap html must be one empty element like '<div class="x"></div>', got ${JSON.stringify(html)}`);
  const tag = m[1].toLowerCase();
  if (["br", "img", "hr", "input", "meta", "link"].includes(tag)) throw new OpError("invalid", `<${tag}> cannot wrap content`);
  const nodes = ids.map((id) => requireMovable(doc, id));
  const parent = nodes[0].parent;
  if (parent === null || nodes.some((x) => x.parent !== parent)) throw new OpError("invalid", "wrap ids must be siblings");
  const kids = doc.nodes[parent].children;
  const order = nodes.map((x) => kids.indexOf(x.id)).sort((a, b) => a - b);
  if (new Set(order).size !== order.length || order.some((v, i2) => i2 > 0 && v !== order[i2 - 1] + 1)) {
    throw new OpError("invalid", "wrap ids must be contiguous siblings");
  }
  const sorted = order.map((i2) => doc.nodes[kids[i2]]);
  const text = doc.text;
  for (let i2 = 1; i2 < sorted.length; i2++) {
    const between = text.slice(sorted[i2 - 1].end, sorted[i2].start).replace(/<!--[\s\S]*?-->/g, "");
    if (between.trim() !== "") throw new OpError("invalid", "wrap ids must be contiguous siblings with no text between them");
  }
  const open = html.trim().slice(0, html.trim().indexOf(">") + 1);
  const close = `</${m[1]}>`;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ind = lineIndent(text, first.start);
  const nl = lineBreak(text);
  if (ind === null) return [{ start: first.start, end: first.start, text: open }, { start: last.end, end: last.end, text: close }];
  return [{ start: first.start, end: first.start, text: open + nl + ind }, { start: last.end, end: last.end, text: nl + ind + close }];
}

// node_modules/acorn/dist/acorn.mjs
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 31, 4, 33, 15, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 199, 7, 137, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 55, 9, 7, 0, 259, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 481, 1, 61, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 12, 2, 9, 1, 3, 0, 33, 1, 1357, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 233, 0, 3, 0, 8, 1, 6, 0, 475, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 13, 65, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 7, 25, 39, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 5, 18, 21, 18, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 18, 0, 182, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 24, 43, 22, 0, 239, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 111, 6, 206, 13, 310, 2314, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 33, 24, 3, 24, 45, 74, 6, 0, 67, 12, 65, 1, 2, 0, 15, 4, 10, 7386, 37, 33, 96, 114, 14, 913, 15, 50, 7710, 3, 2, 6, 2, 1, 2, 296, 10, 0, 30, 2, 3, 0, 15, 4, 8, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 340, 2, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 129, 15, 6, 55, 50, 49, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 208, 30, 2, 2, 2, 1, 2, 6, 3, 4, 10, 1, 225, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4382, 2, 5773, 3, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 8489, 39815, 11327];
var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B53-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\u30FB\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F\uFF65";
var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0558\u0559\u0560-\u0588\u058B\u058C\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088F\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5C\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDC-\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u208F-\u209F\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7DD\uA7E2\uA7F1-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB6C\uAB6D\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
};
var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
var keywords$1 = {
  5: ecma5AndLessKeywords,
  "5module": ecma5AndLessKeywords + " export import",
  6: ecma5AndLessKeywords + " const class extends export import super"
};
var keywordRelationalOperator = /^in(stanceof)?$/;
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
function isInAstralSet(code, set) {
  var pos = 65536;
  for (var i2 = 0; i2 < set.length; i2 += 2) {
    pos += set[i2];
    if (pos > code) {
      return false;
    }
    pos += set[i2 + 1];
    if (pos >= code) {
      return true;
    }
  }
  return false;
}
function isIdentifierStart(code, astral) {
  if (code < 65) {
    return code === 36;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes);
}
function isIdentifierChar(code, astral) {
  if (code < 48) {
    return code === 36;
  }
  if (code < 58) {
    return true;
  }
  if (code < 65) {
    return false;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}
var TokenType2 = function TokenType3(label, conf) {
  if (conf === void 0) conf = {};
  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};
function binop(name, prec) {
  return new TokenType2(name, { beforeExpr: true, binop: prec });
}
var beforeExpr = { beforeExpr: true };
var startsExpr = { startsExpr: true };
var keywords = {};
function kw(name, options) {
  if (options === void 0) options = {};
  options.keyword = name;
  return keywords[name] = new TokenType2(name, options);
}
var types$1 = {
  num: new TokenType2("num", startsExpr),
  regexp: new TokenType2("regexp", startsExpr),
  string: new TokenType2("string", startsExpr),
  name: new TokenType2("name", startsExpr),
  privateId: new TokenType2("privateId", startsExpr),
  eof: new TokenType2("eof"),
  // Punctuation token types.
  bracketL: new TokenType2("[", { beforeExpr: true, startsExpr: true }),
  bracketR: new TokenType2("]"),
  braceL: new TokenType2("{", { beforeExpr: true, startsExpr: true }),
  braceR: new TokenType2("}"),
  parenL: new TokenType2("(", { beforeExpr: true, startsExpr: true }),
  parenR: new TokenType2(")"),
  comma: new TokenType2(",", beforeExpr),
  semi: new TokenType2(";", beforeExpr),
  colon: new TokenType2(":", beforeExpr),
  dot: new TokenType2("."),
  question: new TokenType2("?", beforeExpr),
  questionDot: new TokenType2("?."),
  arrow: new TokenType2("=>", beforeExpr),
  template: new TokenType2("template"),
  invalidTemplate: new TokenType2("invalidTemplate"),
  ellipsis: new TokenType2("...", beforeExpr),
  backQuote: new TokenType2("`", startsExpr),
  dollarBraceL: new TokenType2("${", { beforeExpr: true, startsExpr: true }),
  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.
  eq: new TokenType2("=", { beforeExpr: true, isAssign: true }),
  assign: new TokenType2("_=", { beforeExpr: true, isAssign: true }),
  incDec: new TokenType2("++/--", { prefix: true, postfix: true, startsExpr: true }),
  prefix: new TokenType2("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=/===/!==", 6),
  relational: binop("</>/<=/>=", 7),
  bitShift: binop("<</>>/>>>", 8),
  plusMin: new TokenType2("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType2("**", { beforeExpr: true }),
  coalesce: binop("??", 1),
  // Keyword token types.
  _break: kw("break"),
  _case: kw("case", beforeExpr),
  _catch: kw("catch"),
  _continue: kw("continue"),
  _debugger: kw("debugger"),
  _default: kw("default", beforeExpr),
  _do: kw("do", { isLoop: true, beforeExpr: true }),
  _else: kw("else", beforeExpr),
  _finally: kw("finally"),
  _for: kw("for", { isLoop: true }),
  _function: kw("function", startsExpr),
  _if: kw("if"),
  _return: kw("return", beforeExpr),
  _switch: kw("switch"),
  _throw: kw("throw", beforeExpr),
  _try: kw("try"),
  _var: kw("var"),
  _const: kw("const"),
  _while: kw("while", { isLoop: true }),
  _with: kw("with"),
  _new: kw("new", { beforeExpr: true, startsExpr: true }),
  _this: kw("this", startsExpr),
  _super: kw("super", startsExpr),
  _class: kw("class", startsExpr),
  _extends: kw("extends", beforeExpr),
  _export: kw("export"),
  _import: kw("import", startsExpr),
  _null: kw("null", startsExpr),
  _true: kw("true", startsExpr),
  _false: kw("false", startsExpr),
  _in: kw("in", { beforeExpr: true, binop: 7 }),
  _instanceof: kw("instanceof", { beforeExpr: true, binop: 7 }),
  _typeof: kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
  _void: kw("void", { beforeExpr: true, prefix: true, startsExpr: true }),
  _delete: kw("delete", { beforeExpr: true, prefix: true, startsExpr: true })
};
var lineBreak2 = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak2.source, "g");
function isNewLine(code) {
  return code === 10 || code === 13 || code === 8232 || code === 8233;
}
function nextLineBreak(code, from, end) {
  if (end === void 0) end = code.length;
  for (var i2 = from; i2 < end; i2++) {
    var next = code.charCodeAt(i2);
    if (isNewLine(next)) {
      return i2 < end - 1 && next === 13 && code.charCodeAt(i2 + 1) === 10 ? i2 + 2 : i2 + 1;
    }
  }
  return -1;
}
var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
var ref = Object.prototype;
var hasOwnProperty = ref.hasOwnProperty;
var toString = ref.toString;
var hasOwn = Object.hasOwn || (function(obj, propName) {
  return hasOwnProperty.call(obj, propName);
});
var isArray = Array.isArray || (function(obj) {
  return toString.call(obj) === "[object Array]";
});
var regexpCache = /* @__PURE__ */ Object.create(null);
function wordsRegexp(words) {
  return regexpCache[words] || (regexpCache[words] = new RegExp("^(?:" + words.replace(/ /g, "|") + ")$"));
}
function codePointToString2(code) {
  if (code <= 65535) {
    return String.fromCharCode(code);
  }
  code -= 65536;
  return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
}
var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;
var Position = function Position2(line, col) {
  this.line = line;
  this.column = col;
};
Position.prototype.offset = function offset(n) {
  return new Position(this.line, this.column + n);
};
var SourceLocation = function SourceLocation2(p, start, end) {
  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) {
    this.source = p.sourceFile;
  }
};
function getLineInfo(input, offset2) {
  for (var line = 1, cur = 0; ; ) {
    var nextBreak = nextLineBreak(input, cur, offset2);
    if (nextBreak < 0) {
      return new Position(line, offset2 - cur);
    }
    ++line;
    cur = nextBreak;
  }
}
var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
  // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10
  // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `"latest"`
  // (the latest version the library supports). This influences
  // support for strict mode, the set of reserved words, and support
  // for new syntax features.
  ecmaVersion: null,
  // `sourceType` indicates the mode the code should be parsed in.
  // Can be either `"script"`, `"module"` or `"commonjs"`. This influences global
  // strict mode and parsing of `import` and `export` declarations.
  sourceType: "script",
  // When set to true, enable strict parsing mode even if `sourceType`
  // is `"script"`.
  strict: false,
  // `onInsertedSemicolon` can be a callback that will be called when
  // a semicolon is automatically inserted. It will be passed the
  // position of the inserted semicolon as an offset, and if
  // `locations` is enabled, it is given the location as a `{line,
  // column}` object as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are only enforced if ecmaVersion >= 5.
  // Set `allowReserved` to a boolean value to explicitly turn this on
  // an off. When this option has the value "never", reserved words
  // and keywords can also not be used as property names.
  allowReserved: null,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program, and an import.meta expression
  // in a script isn't considered an error.
  allowImportExportEverywhere: false,
  // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.
  // When enabled, await identifiers are allowed to appear at the top-level scope,
  // but they are still not allowed in non-async functions.
  allowAwaitOutsideFunction: null,
  // When enabled, super identifiers are not constrained to
  // appearing in methods and do not raise an error when they appear elsewhere.
  allowSuperOutsideMethod: null,
  // When enabled, hashbang directive in the beginning of file is
  // allowed and treated as a line comment. Enabled by default when
  // `ecmaVersion` >= 2023.
  allowHashBang: false,
  // By default, the parser will verify that private properties are
  // only used in places where they are valid and have been declared.
  // Set this to false to turn such checks off.
  checkPrivateFields: true,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // Pass an optional `{line, column}` object to use for the start of
  // the parse. This is mostly useful when using `parseExpressionAt`
  // with `locations: true`, to prevent the parser from having to
  // determine the line position at the start position.
  startLocation: null,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokens returned from `tokenizer().getToken()`. Note
  // that you are not allowed to call the parser from the
  // callback—that will corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  // When this option has an array as value, objects representing the
  // comments are pushed to it.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false
};
var warnedAboutEcmaVersion = false;
function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt];
  }
  if (options.ecmaVersion === "latest") {
    options.ecmaVersion = 1e8;
  } else if (options.ecmaVersion == null) {
    if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
      warnedAboutEcmaVersion = true;
      console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
    }
    options.ecmaVersion = 11;
  } else if (options.ecmaVersion >= 2015) {
    options.ecmaVersion -= 2009;
  }
  if (options.allowReserved == null) {
    options.allowReserved = options.ecmaVersion < 5;
  }
  if (!opts || opts.allowHashBang == null) {
    options.allowHashBang = options.ecmaVersion >= 14;
  }
  if (isArray(options.onToken)) {
    var tokens = options.onToken;
    options.onToken = function(token) {
      return tokens.push(token);
    };
  }
  if (isArray(options.onComment)) {
    options.onComment = pushComment(options, options.onComment);
  }
  if (options.sourceType === "commonjs" && options.allowAwaitOutsideFunction) {
    throw new Error("Cannot use allowAwaitOutsideFunction with sourceType: commonjs");
  }
  return options;
}
function pushComment(options, array) {
  return function(block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text,
      start,
      end
    };
    if (options.locations) {
      comment.loc = new SourceLocation(this, startLoc, endLoc);
    }
    if (options.ranges) {
      comment.range = [start, end];
    }
    array.push(comment);
  };
}
var SCOPE_TOP = 1;
var SCOPE_FUNCTION = 2;
var SCOPE_ASYNC = 4;
var SCOPE_GENERATOR = 8;
var SCOPE_ARROW = 16;
var SCOPE_SIMPLE_CATCH = 32;
var SCOPE_SUPER = 64;
var SCOPE_DIRECT_SUPER = 128;
var SCOPE_CLASS_STATIC_BLOCK = 256;
var SCOPE_CLASS_FIELD_INIT = 512;
var SCOPE_SWITCH = 1024;
var SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;
function functionFlags(async, generator) {
  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0);
}
var BIND_NONE = 0;
var BIND_VAR = 1;
var BIND_LEXICAL = 2;
var BIND_FUNCTION = 3;
var BIND_SIMPLE_CATCH = 4;
var BIND_OUTSIDE = 5;
var Parser2 = function Parser3(options, input, startPos) {
  this.options = options = getOptions(options);
  this.sourceFile = options.sourceFile;
  this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
  var reserved = "";
  if (options.allowReserved !== true) {
    reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
    if (options.sourceType === "module") {
      reserved += " await";
    }
  }
  this.reservedWords = wordsRegexp(reserved);
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
  this.reservedWordsStrict = wordsRegexp(reservedStrict);
  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
  this.input = String(input);
  this.containsEsc = false;
  this.pos = startPos || 0;
  this.curLine = 1;
  if (options.startLocation) {
    this.lineStart = this.pos - options.startLocation.column;
    this.curLine = options.startLocation.line;
  } else if (startPos) {
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    if (this.options.locations) {
      this.curLine = this.input.slice(0, this.lineStart).split(lineBreak2).length;
    }
  } else {
    this.lineStart = 0;
  }
  this.type = types$1.eof;
  this.value = null;
  this.start = this.end = this.pos;
  this.startLoc = this.endLoc = this.curPosition();
  this.lastTokEndLoc = this.lastTokStartLoc = null;
  this.lastTokStart = this.lastTokEnd = this.pos;
  this.context = this.initialContext();
  this.exprAllowed = true;
  this.inModule = options.sourceType === "module";
  this.strict = this.inModule || options.strict === true || this.strictDirective(this.pos);
  this.potentialArrowAt = -1;
  this.potentialArrowInForAwait = false;
  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
  this.labels = [];
  this.undefinedExports = /* @__PURE__ */ Object.create(null);
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
    this.skipLineComment(2);
  }
  this.scopeStack = [];
  this.enterScope(
    this.options.sourceType === "commonjs" ? SCOPE_FUNCTION : SCOPE_TOP
  );
  this.regexpState = null;
  this.privateNameStack = [];
};
var prototypeAccessors = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, canAwait: { configurable: true }, allowReturn: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true }, allowNewDotTarget: { configurable: true }, allowUsing: { configurable: true }, inClassStaticBlock: { configurable: true } };
Parser2.prototype.parse = function parse2() {
  var this$1$1 = this;
  var node = this.options.program || this.startNode();
  this.nextToken();
  return this.catchStackOverflow(function() {
    return this$1$1.parseTopLevel(node);
  });
};
prototypeAccessors.inFunction.get = function() {
  return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0;
};
prototypeAccessors.inGenerator.get = function() {
  return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0;
};
prototypeAccessors.inAsync.get = function() {
  return (this.currentVarScope().flags & SCOPE_ASYNC) > 0;
};
prototypeAccessors.canAwait.get = function() {
  for (var i2 = this.scopeStack.length - 1; i2 >= 0; i2--) {
    var ref2 = this.scopeStack[i2];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT)) {
      return false;
    }
    if (flags & SCOPE_FUNCTION) {
      return (flags & SCOPE_ASYNC) > 0;
    }
  }
  return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
};
prototypeAccessors.allowReturn.get = function() {
  if (this.inFunction) {
    return true;
  }
  if (this.options.allowReturnOutsideFunction && this.currentVarScope().flags & SCOPE_TOP) {
    return true;
  }
  return false;
};
prototypeAccessors.allowSuper.get = function() {
  var ref2 = this.currentThisScope();
  var flags = ref2.flags;
  return (flags & SCOPE_SUPER) > 0 || this.options.allowSuperOutsideMethod;
};
prototypeAccessors.allowDirectSuper.get = function() {
  return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0;
};
prototypeAccessors.treatFunctionsAsVar.get = function() {
  return this.treatFunctionsAsVarInScope(this.currentScope());
};
prototypeAccessors.allowNewDotTarget.get = function() {
  for (var i2 = this.scopeStack.length - 1; i2 >= 0; i2--) {
    var ref2 = this.scopeStack[i2];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) || flags & SCOPE_FUNCTION && !(flags & SCOPE_ARROW)) {
      return true;
    }
  }
  return false;
};
prototypeAccessors.allowUsing.get = function() {
  var ref2 = this.currentScope();
  var flags = ref2.flags;
  if (flags & SCOPE_SWITCH) {
    return false;
  }
  if (!this.inModule && flags & SCOPE_TOP) {
    return false;
  }
  return true;
};
prototypeAccessors.inClassStaticBlock.get = function() {
  return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0;
};
Parser2.extend = function extend() {
  var plugins = [], len = arguments.length;
  while (len--) plugins[len] = arguments[len];
  var cls = this;
  for (var i2 = 0; i2 < plugins.length; i2++) {
    cls = plugins[i2](cls);
  }
  return cls;
};
Parser2.parse = function parse3(input, options) {
  return new this(options, input).parse();
};
Parser2.parseExpressionAt = function parseExpressionAt(input, pos, options) {
  var parser = new this(options, input, pos);
  parser.nextToken();
  return parser.parseExpression();
};
Parser2.tokenizer = function tokenizer(input, options) {
  return new this(options, input);
};
Object.defineProperties(Parser2.prototype, prototypeAccessors);
var pp$9 = Parser2.prototype;
var literal = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
pp$9.strictDirective = function(start) {
  if (this.options.ecmaVersion < 5) {
    return false;
  }
  for (; ; ) {
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    var match = literal.exec(this.input.slice(start));
    if (!match) {
      return false;
    }
    if ((match[1] || match[2]) === "use strict") {
      skipWhiteSpace.lastIndex = start + match[0].length;
      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
      var next = this.input.charAt(end);
      return next === ";" || next === "}" || lineBreak2.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=" || next === "i" && keywordOpAt(this, end));
    }
    start += match[0].length;
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    if (this.input[start] === ";") {
      start++;
    }
  }
};
function keywordOpAt(parser, pos) {
  var end = pos + 1, stop = Math.min(parser.input.length, pos + 11);
  while (end < stop) {
    var ch = parser.fullCharCodeAt(end);
    if (!isIdentifierChar(ch, true)) {
      break;
    }
    end += ch <= 65535 ? 1 : 2;
  }
  return end === pos + 2 && parser.input.slice(pos, end) === "in" || end === pos + 10 && parser.input.slice(pos, end) === "instanceof";
}
pp$9.eat = function(type) {
  if (this.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};
pp$9.isContextual = function(name) {
  return this.type === types$1.name && this.value === name && !this.containsEsc;
};
pp$9.eatContextual = function(name) {
  if (!this.isContextual(name)) {
    return false;
  }
  this.next();
  return true;
};
pp$9.catchStackOverflow = function(f) {
  try {
    return f();
  } catch (e) {
    if (e instanceof Error && (/\bstack\b.*\b(exceeded|overflow)\b/i.test(e.message) || /\btoo much recursion\b/i.test(e.message))) {
      this.raise(this.start, "Not enough stack space to parse input");
    } else {
      throw e;
    }
  }
};
pp$9.expectContextual = function(name) {
  if (!this.eatContextual(name)) {
    this.unexpected();
  }
};
pp$9.canInsertSemicolon = function() {
  return this.type === types$1.eof || this.type === types$1.braceR || lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$9.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon) {
      this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
    }
    return true;
  }
};
pp$9.semicolon = function() {
  if (!this.eat(types$1.semi) && !this.insertSemicolon()) {
    this.unexpected();
  }
};
pp$9.afterTrailingComma = function(tokType, notNext) {
  if (this.type === tokType) {
    if (this.options.onTrailingComma) {
      this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
    }
    if (!notNext) {
      this.next();
    }
    return true;
  }
};
pp$9.expect = function(type) {
  this.eat(type) || this.unexpected();
};
pp$9.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};
var DestructuringErrors = function DestructuringErrors2() {
  this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
};
pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) {
    return;
  }
  if (refDestructuringErrors.trailingComma > -1) {
    this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
  }
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
  if (parens > -1) {
    this.raiseRecoverable(parens, isAssign ? "Assigning to rvalue" : "Parenthesized pattern");
  }
};
pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) {
    return false;
  }
  var shorthandAssign = refDestructuringErrors.shorthandAssign;
  var doubleProto = refDestructuringErrors.doubleProto;
  if (!andThrow) {
    return shorthandAssign >= 0 || doubleProto >= 0;
  }
  if (shorthandAssign >= 0) {
    this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
  }
  if (doubleProto >= 0) {
    this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
  }
};
pp$9.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
    this.raise(this.yieldPos, "Yield expression cannot be a default value");
  }
  if (this.awaitPos) {
    this.raise(this.awaitPos, "Await expression cannot be a default value");
  }
};
pp$9.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression") {
    return this.isSimpleAssignTarget(expr.expression);
  }
  return expr.type === "Identifier" || expr.type === "MemberExpression";
};
var pp$8 = Parser2.prototype;
pp$8.parseTopLevel = function(node) {
  var exports$1 = /* @__PURE__ */ Object.create(null);
  if (!node.body) {
    node.body = [];
  }
  while (this.type !== types$1.eof) {
    var stmt = this.parseStatement(null, true, exports$1);
    node.body.push(stmt);
  }
  if (this.inModule) {
    for (var i2 = 0, list2 = Object.keys(this.undefinedExports); i2 < list2.length; i2 += 1) {
      var name = list2[i2];
      this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
    }
  }
  this.adaptDirectivePrologue(node.body);
  this.next();
  node.sourceType = this.options.sourceType === "commonjs" ? "script" : this.options.sourceType;
  return this.finishNode(node, "Program");
};
var loopLabel = { kind: "loop" };
var switchLabel = { kind: "switch" };
pp$8.isLet = function(context) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, nextCh = this.fullCharCodeAt(next);
  if (nextCh === 91 || nextCh === 92) {
    return true;
  }
  if (context) {
    return false;
  }
  if (nextCh === 123) {
    return true;
  }
  if (isIdentifierStart(nextCh)) {
    var start = next;
    do {
      next += nextCh <= 65535 ? 1 : 2;
    } while (isIdentifierChar(nextCh = this.fullCharCodeAt(next)));
    if (nextCh === 92) {
      return true;
    }
    var ident = this.input.slice(start, next);
    if (!keywordRelationalOperator.test(ident)) {
      return true;
    }
  }
  return false;
};
pp$8.isAsyncFunction = function() {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, after;
  return !lineBreak2.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !(isIdentifierChar(after = this.fullCharCodeAt(next + 8)) || after === 92));
};
pp$8.isUsingKeyword = function(isAwaitUsing, isFor) {
  if (this.options.ecmaVersion < 17 || !this.isContextual(isAwaitUsing ? "await" : "using")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length;
  if (lineBreak2.test(this.input.slice(this.pos, next))) {
    return false;
  }
  if (isAwaitUsing) {
    var usingEndPos = next + 5, after;
    if (this.input.slice(next, usingEndPos) !== "using" || usingEndPos === this.input.length || isIdentifierChar(after = this.fullCharCodeAt(usingEndPos)) || after === 92) {
      return false;
    }
    skipWhiteSpace.lastIndex = usingEndPos;
    var skipAfterUsing = skipWhiteSpace.exec(this.input);
    next = usingEndPos + skipAfterUsing[0].length;
    if (skipAfterUsing && lineBreak2.test(this.input.slice(usingEndPos, next))) {
      return false;
    }
  }
  var ch = this.fullCharCodeAt(next);
  if (!isIdentifierStart(ch) && ch !== 92) {
    return false;
  }
  var idStart = next;
  do {
    next += ch <= 65535 ? 1 : 2;
  } while (isIdentifierChar(ch = this.fullCharCodeAt(next)));
  if (ch === 92) {
    return true;
  }
  var id = this.input.slice(idStart, next);
  if (keywordRelationalOperator.test(id)) {
    return false;
  }
  if (isFor && !isAwaitUsing && id === "of") {
    skipWhiteSpace.lastIndex = next;
    var skipAfterOf = skipWhiteSpace.exec(this.input);
    next = next + skipAfterOf[0].length;
    if (this.input.charCodeAt(next) !== 61 || // Check for ==, === and => operators
    (ch = this.input.charCodeAt(next + 1)) === 61 || ch === 62) {
      return false;
    }
  }
  return true;
};
pp$8.isAwaitUsing = function(isFor) {
  return this.isUsingKeyword(true, isFor);
};
pp$8.isUsing = function(isFor) {
  return this.isUsingKeyword(false, isFor);
};
pp$8.parseStatement = function(context, topLevel, exports$1) {
  var starttype = this.type, node = this.startNode(), kind;
  if (this.isLet(context)) {
    starttype = types$1._var;
    kind = "let";
  }
  switch (starttype) {
    case types$1._break:
    case types$1._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case types$1._debugger:
      return this.parseDebuggerStatement(node);
    case types$1._do:
      return this.parseDoStatement(node);
    case types$1._for:
      return this.parseForStatement(node);
    case types$1._function:
      if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
        this.unexpected();
      }
      return this.parseFunctionStatement(node, false, !context);
    case types$1._class:
      if (context) {
        this.unexpected();
      }
      return this.parseClass(node, true);
    case types$1._if:
      return this.parseIfStatement(node);
    case types$1._return:
      return this.parseReturnStatement(node);
    case types$1._switch:
      return this.parseSwitchStatement(node);
    case types$1._throw:
      return this.parseThrowStatement(node);
    case types$1._try:
      return this.parseTryStatement(node);
    case types$1._const:
    case types$1._var:
      kind = kind || this.value;
      if (context && kind !== "var") {
        this.unexpected();
      }
      return this.parseVarStatement(node, kind);
    case types$1._while:
      return this.parseWhileStatement(node);
    case types$1._with:
      return this.parseWithStatement(node);
    case types$1.braceL:
      return this.parseBlock(true, node);
    case types$1.semi:
      return this.parseEmptyStatement(node);
    case types$1._export:
    case types$1._import:
      if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
        skipWhiteSpace.lastIndex = this.pos;
        var skip = skipWhiteSpace.exec(this.input);
        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
        if (nextCh === 40 || nextCh === 46) {
          return this.parseExpressionStatement(node, this.parseExpression());
        }
      }
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) {
          this.raise(this.start, "'import' and 'export' may only appear at the top level");
        }
        if (!this.inModule) {
          this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
        }
      }
      return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports$1);
    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    default:
      if (this.isAsyncFunction()) {
        if (context) {
          this.unexpected();
        }
        this.next();
        return this.parseFunctionStatement(node, true, !context);
      }
      var usingKind = this.isAwaitUsing(false) ? "await using" : this.isUsing(false) ? "using" : null;
      if (usingKind) {
        if (!this.allowUsing) {
          this.raise(this.start, "Using declaration cannot appear in the top level when source type is `script` or in the bare case statement");
        }
        if (context) {
          this.raise(this.start, "Using declaration is not allowed in single-statement positions");
        }
        if (usingKind === "await using") {
          if (!this.canAwait) {
            this.raise(this.start, "Await using cannot appear outside of async function");
          }
          this.next();
        }
        this.next();
        this.parseVar(node, false, usingKind);
        this.semicolon();
        return this.finishNode(node, "VariableDeclaration");
      }
      var maybeName = this.value, expr = this.parseExpression();
      if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon)) {
        return this.parseLabeledStatement(node, maybeName, expr, context);
      } else {
        return this.parseExpressionStatement(node, expr);
      }
  }
};
pp$8.parseBreakContinueStatement = function(node, keyword) {
  var isBreak = keyword === "break";
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.label = null;
  } else if (this.type !== types$1.name) {
    this.unexpected();
  } else {
    node.label = this.parseIdent();
    this.semicolon();
  }
  var i2 = 0;
  for (; i2 < this.labels.length; ++i2) {
    var lab = this.labels[i2];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) {
        break;
      }
      if (node.label && isBreak) {
        break;
      }
    }
  }
  if (i2 === this.labels.length) {
    this.raise(node.start, "Unsyntactic " + keyword);
  }
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
};
pp$8.parseDebuggerStatement = function(node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement");
};
pp$8.parseDoStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("do");
  this.labels.pop();
  this.expect(types$1._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) {
    this.eat(types$1.semi);
  } else {
    this.semicolon();
  }
  return this.finishNode(node, "DoWhileStatement");
};
pp$8.parseForStatement = function(node) {
  this.next();
  var awaitAt = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
  this.labels.push(loopLabel);
  this.enterScope(0);
  this.expect(types$1.parenL);
  if (this.type === types$1.semi) {
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, null);
  }
  var isLet = this.isLet();
  if (this.type === types$1._var || this.type === types$1._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    this.next();
    this.parseVar(init$1, true, kind);
    this.finishNode(init$1, "VariableDeclaration");
    return this.parseForAfterInit(node, init$1, awaitAt);
  }
  var startsWithLet = this.isContextual("let"), isForOf = false;
  var usingKind = this.isUsing(true) ? "using" : this.isAwaitUsing(true) ? "await using" : null;
  if (usingKind) {
    var init$2 = this.startNode();
    this.next();
    if (usingKind === "await using") {
      if (!this.canAwait) {
        this.raise(this.start, "Await using cannot appear outside of async function");
      }
      this.next();
    }
    this.parseVar(init$2, true, usingKind);
    this.finishNode(init$2, "VariableDeclaration");
    return this.parseForAfterInit(node, init$2, awaitAt);
  }
  var containsEsc = this.containsEsc;
  var refDestructuringErrors = new DestructuringErrors();
  var initPos = this.start;
  var init = awaitAt > -1 ? this.parseExprSubscripts(refDestructuringErrors, "await") : this.parseExpression(true, refDestructuringErrors);
  if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    if (awaitAt > -1) {
      if (this.type === types$1._in) {
        this.unexpected(awaitAt);
      }
      node.await = true;
    } else if (isForOf && this.options.ecmaVersion >= 8) {
      if (init.start === initPos && !containsEsc && init.type === "Identifier" && init.name === "async") {
        this.unexpected();
      } else if (this.options.ecmaVersion >= 9) {
        node.await = false;
      }
    }
    if (startsWithLet && isForOf) {
      this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'.");
    }
    this.toAssignable(init, false, refDestructuringErrors);
    this.checkLValPattern(init);
    return this.parseForIn(node, init);
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$8.parseForAfterInit = function(node, init, awaitAt) {
  if ((this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init.declarations.length === 1) {
    if (this.type === types$1._in) {
      if ((init.kind === "using" || init.kind === "await using") && !init.declarations[0].init) {
        this.raise(this.start, "Using declaration is not allowed in for-in loops");
      }
      if (this.options.ecmaVersion >= 9 && awaitAt > -1) {
        this.unexpected(awaitAt);
      }
    } else if (this.options.ecmaVersion >= 9) {
      node.await = awaitAt > -1;
    }
    return this.parseForIn(node, init);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
  this.next();
  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync);
};
pp$8.parseIfStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  node.consequent = this.parseStatement("if");
  node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
  return this.finishNode(node, "IfStatement");
};
pp$8.parseReturnStatement = function(node) {
  if (!this.allowReturn) {
    this.raise(this.start, "'return' outside of function");
  }
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.argument = null;
  } else {
    node.argument = this.parseExpression();
    this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};
pp$8.parseSwitchStatement = function(node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(types$1.braceL);
  this.labels.push(switchLabel);
  this.enterScope(SCOPE_SWITCH);
  var cur;
  for (var sawDefault = false; this.type !== types$1.braceR; ) {
    if (this.type === types$1._case || this.type === types$1._default) {
      var isCase = this.type === types$1._case;
      if (cur) {
        this.finishNode(cur, "SwitchCase");
      }
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) {
          this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
        }
        sawDefault = true;
        cur.test = null;
      }
      this.expect(types$1.colon);
    } else {
      if (!cur) {
        this.unexpected();
      }
      cur.consequent.push(this.parseStatement(null));
    }
  }
  this.exitScope();
  if (cur) {
    this.finishNode(cur, "SwitchCase");
  }
  this.next();
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement");
};
pp$8.parseThrowStatement = function(node) {
  this.next();
  if (lineBreak2.test(this.input.slice(this.lastTokEnd, this.start))) {
    this.raise(this.lastTokEnd, "Illegal newline after throw");
  }
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement");
};
var empty$1 = [];
pp$8.parseCatchClauseParam = function() {
  var param = this.parseBindingAtom();
  var simple = param.type === "Identifier";
  this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
  this.checkLValPattern(param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
  this.expect(types$1.parenR);
  return param;
};
pp$8.parseTryStatement = function(node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === types$1._catch) {
    var clause = this.startNode();
    this.next();
    if (this.eat(types$1.parenL)) {
      clause.param = this.parseCatchClauseParam();
    } else {
      if (this.options.ecmaVersion < 10) {
        this.unexpected();
      }
      clause.param = null;
      this.enterScope(0);
    }
    clause.body = this.parseBlock(false);
    this.exitScope();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer) {
    this.raise(node.start, "Missing catch or finally clause");
  }
  return this.finishNode(node, "TryStatement");
};
pp$8.parseVarStatement = function(node, kind, allowMissingInitializer) {
  this.next();
  this.parseVar(node, false, kind, allowMissingInitializer);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};
pp$8.parseWhileStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("while");
  this.labels.pop();
  return this.finishNode(node, "WhileStatement");
};
pp$8.parseWithStatement = function(node) {
  if (this.strict) {
    this.raise(this.start, "'with' in strict mode");
  }
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement("with");
  return this.finishNode(node, "WithStatement");
};
pp$8.parseEmptyStatement = function(node) {
  this.next();
  return this.finishNode(node, "EmptyStatement");
};
pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
  for (var i$1 = 0, list2 = this.labels; i$1 < list2.length; i$1 += 1) {
    var label = list2[i$1];
    if (label.name === maybeName) {
      this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    }
  }
  var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
  for (var i2 = this.labels.length - 1; i2 >= 0; i2--) {
    var label$1 = this.labels[i2];
    if (label$1.statementStart === node.start) {
      label$1.statementStart = this.start;
      label$1.kind = kind;
    } else {
      break;
    }
  }
  this.labels.push({ name: maybeName, kind, statementStart: this.start });
  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement");
};
pp$8.parseExpressionStatement = function(node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement");
};
pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
  if (createNewLexicalScope === void 0) createNewLexicalScope = true;
  if (node === void 0) node = this.startNode();
  node.body = [];
  this.expect(types$1.braceL);
  if (createNewLexicalScope) {
    this.enterScope(0);
  }
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  if (exitStrict) {
    this.strict = false;
  }
  this.next();
  if (createNewLexicalScope) {
    this.exitScope();
  }
  return this.finishNode(node, "BlockStatement");
};
pp$8.parseFor = function(node, init) {
  node.init = init;
  this.expect(types$1.semi);
  node.test = this.type === types$1.semi ? null : this.parseExpression();
  this.expect(types$1.semi);
  node.update = this.type === types$1.parenR ? null : this.parseExpression();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};
pp$8.parseForIn = function(node, init) {
  var isForIn = this.type === types$1._in;
  this.next();
  if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
    this.raise(
      init.start,
      (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer"
    );
  }
  node.left = init;
  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
};
pp$8.parseVar = function(node, isFor, kind, allowMissingInitializer) {
  node.declarations = [];
  node.kind = kind;
  for (; ; ) {
    var decl = this.startNode();
    this.parseVarId(decl, kind);
    if (this.eat(types$1.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (!allowMissingInitializer && kind === "const" && !(this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (!allowMissingInitializer && (kind === "using" || kind === "await using") && this.options.ecmaVersion >= 17 && this.type !== types$1._in && !this.isContextual("of")) {
      this.raise(this.lastTokEnd, "Missing initializer in " + kind + " declaration");
    } else if (!allowMissingInitializer && decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(types$1.comma)) {
      break;
    }
  }
  return node;
};
pp$8.parseVarId = function(decl, kind) {
  decl.id = kind === "using" || kind === "await using" ? this.parseIdent() : this.parseBindingAtom();
  this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
};
var FUNC_STATEMENT = 1;
var FUNC_HANGING_STATEMENT = 2;
var FUNC_NULLABLE_ID = 4;
pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    if (this.type === types$1.star && statement & FUNC_HANGING_STATEMENT) {
      this.unexpected();
    }
    node.generator = this.eat(types$1.star);
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  if (statement & FUNC_STATEMENT) {
    node.id = statement & FUNC_NULLABLE_ID && this.type !== types$1.name ? null : this.parseIdent();
    if (node.id && !(statement & FUNC_HANGING_STATEMENT)) {
      this.checkLValSimple(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION);
    }
  }
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(node.async, node.generator));
  if (!(statement & FUNC_STATEMENT)) {
    node.id = this.type === types$1.name ? this.parseIdent() : null;
  }
  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, statement & FUNC_STATEMENT ? "FunctionDeclaration" : "FunctionExpression");
};
pp$8.parseFunctionParams = function(node) {
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
};
pp$8.parseClass = function(node, isStatement) {
  this.next();
  var oldStrict = this.strict;
  this.strict = true;
  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var privateNameMap = this.enterClassBody();
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(types$1.braceL);
  while (this.type !== types$1.braceR) {
    var element = this.parseClassElement(node.superClass !== null);
    if (element) {
      classBody.body.push(element);
      if (element.type === "MethodDefinition" && element.kind === "constructor") {
        if (hadConstructor) {
          this.raiseRecoverable(element.start, "Duplicate constructor in the same class");
        }
        hadConstructor = true;
      } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
        this.raiseRecoverable(element.key.start, "Identifier '#" + element.key.name + "' has already been declared");
      }
    }
  }
  this.strict = oldStrict;
  this.next();
  node.body = this.finishNode(classBody, "ClassBody");
  this.exitClassBody();
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};
pp$8.parseClassElement = function(constructorAllowsSuper) {
  if (this.eat(types$1.semi)) {
    return null;
  }
  var ecmaVersion2 = this.options.ecmaVersion;
  var node = this.startNode();
  var keyName2 = "";
  var isGenerator = false;
  var isAsync = false;
  var kind = "method";
  var isStatic = false;
  if (this.eatContextual("static")) {
    if (ecmaVersion2 >= 13 && this.eat(types$1.braceL)) {
      this.parseClassStaticBlock(node);
      return node;
    }
    if (this.isClassElementNameStart() || this.type === types$1.star) {
      isStatic = true;
    } else {
      keyName2 = "static";
    }
  }
  node.static = isStatic;
  if (!keyName2 && ecmaVersion2 >= 8 && this.eatContextual("async")) {
    if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
      isAsync = true;
    } else {
      keyName2 = "async";
    }
  }
  if (!keyName2 && (ecmaVersion2 >= 9 || !isAsync) && this.eat(types$1.star)) {
    isGenerator = true;
  }
  if (!keyName2 && !isAsync && !isGenerator) {
    var lastValue = this.value;
    if (this.eatContextual("get") || this.eatContextual("set")) {
      if (this.isClassElementNameStart()) {
        kind = lastValue;
      } else {
        keyName2 = lastValue;
      }
    }
  }
  if (keyName2) {
    node.computed = false;
    node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
    node.key.name = keyName2;
    this.finishNode(node.key, "Identifier");
  } else {
    this.parseClassElementName(node);
  }
  if (ecmaVersion2 < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
    var isConstructor = !node.static && checkKeyName(node, "constructor");
    var allowsDirectSuper = isConstructor && constructorAllowsSuper;
    if (isConstructor && kind !== "method") {
      this.raise(node.key.start, "Constructor can't have get/set modifier");
    }
    node.kind = isConstructor ? "constructor" : kind;
    this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
  } else {
    this.parseClassField(node);
  }
  return node;
};
pp$8.isClassElementNameStart = function() {
  return this.type === types$1.name || this.type === types$1.privateId || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword;
};
pp$8.parseClassElementName = function(element) {
  if (this.type === types$1.privateId) {
    if (this.value === "constructor") {
      this.raise(this.start, "Classes can't have an element named '#constructor'");
    }
    element.computed = false;
    element.key = this.parsePrivateIdent();
  } else {
    this.parsePropertyName(element);
  }
};
pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
  var key = method.key;
  if (method.kind === "constructor") {
    if (isGenerator) {
      this.raise(key.start, "Constructor can't be a generator");
    }
    if (isAsync) {
      this.raise(key.start, "Constructor can't be an async method");
    }
  } else if (method.static && checkKeyName(method, "prototype")) {
    this.raise(key.start, "Classes may not have a static property named prototype");
  }
  var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
  if (method.kind === "get" && value.params.length !== 0) {
    this.raiseRecoverable(value.start, "getter should have no params");
  }
  if (method.kind === "set" && value.params.length !== 1) {
    this.raiseRecoverable(value.start, "setter should have exactly one param");
  }
  if (method.kind === "set" && value.params[0].type === "RestElement") {
    this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params");
  }
  return this.finishNode(method, "MethodDefinition");
};
pp$8.parseClassField = function(field) {
  if (checkKeyName(field, "constructor")) {
    this.raise(field.key.start, "Classes can't have a field named 'constructor'");
  } else if (field.static && checkKeyName(field, "prototype")) {
    this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
  }
  if (this.eat(types$1.eq)) {
    this.enterScope(SCOPE_CLASS_FIELD_INIT | SCOPE_SUPER);
    field.value = this.parseMaybeAssign();
    this.exitScope();
  } else {
    field.value = null;
  }
  this.semicolon();
  return this.finishNode(field, "PropertyDefinition");
};
pp$8.parseClassStaticBlock = function(node) {
  node.body = [];
  var oldLabels = this.labels;
  this.labels = [];
  this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  this.next();
  this.exitScope();
  this.labels = oldLabels;
  return this.finishNode(node, "StaticBlock");
};
pp$8.parseClassId = function(node, isStatement) {
  if (this.type === types$1.name) {
    node.id = this.parseIdent();
    if (isStatement) {
      this.checkLValSimple(node.id, BIND_LEXICAL, false);
    }
  } else {
    if (isStatement === true) {
      this.unexpected();
    }
    node.id = null;
  }
};
pp$8.parseClassSuper = function(node) {
  node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;
};
pp$8.enterClassBody = function() {
  var element = { declared: /* @__PURE__ */ Object.create(null), used: [] };
  this.privateNameStack.push(element);
  return element.declared;
};
pp$8.exitClassBody = function() {
  var ref2 = this.privateNameStack.pop();
  var declared = ref2.declared;
  var used = ref2.used;
  if (!this.options.checkPrivateFields) {
    return;
  }
  var len = this.privateNameStack.length;
  var parent = len === 0 ? null : this.privateNameStack[len - 1];
  for (var i2 = 0; i2 < used.length; ++i2) {
    var id = used[i2];
    if (!hasOwn(declared, id.name)) {
      if (parent) {
        parent.used.push(id);
      } else {
        this.raiseRecoverable(id.start, "Private field '#" + id.name + "' must be declared in an enclosing class");
      }
    }
  }
};
function isPrivateNameConflicted(privateNameMap, element) {
  var name = element.key.name;
  var curr = privateNameMap[name];
  var next = "true";
  if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
    next = (element.static ? "s" : "i") + element.kind;
  }
  if (curr === "iget" && next === "iset" || curr === "iset" && next === "iget" || curr === "sget" && next === "sset" || curr === "sset" && next === "sget") {
    privateNameMap[name] = "true";
    return false;
  } else if (!curr) {
    privateNameMap[name] = next;
    return false;
  } else {
    return true;
  }
}
function checkKeyName(node, name) {
  var computed = node.computed;
  var key = node.key;
  return !computed && (key.type === "Identifier" && key.name === name || key.type === "Literal" && key.value === name);
}
pp$8.parseExportAllDeclaration = function(node, exports$1) {
  if (this.options.ecmaVersion >= 11) {
    if (this.eatContextual("as")) {
      node.exported = this.parseModuleExportName();
      this.checkExport(exports$1, node.exported, this.lastTokStart);
    } else {
      node.exported = null;
    }
  }
  this.expectContextual("from");
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.source = this.parseExprAtom();
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ExportAllDeclaration");
};
pp$8.parseExport = function(node, exports$1) {
  this.next();
  if (this.eat(types$1.star)) {
    return this.parseExportAllDeclaration(node, exports$1);
  }
  if (this.eat(types$1._default)) {
    this.checkExport(exports$1, "default", this.lastTokStart);
    node.declaration = this.parseExportDefaultDeclaration();
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseExportDeclaration(node);
    if (node.declaration.type === "VariableDeclaration") {
      this.checkVariableExport(exports$1, node.declaration.declarations);
    } else {
      this.checkExport(exports$1, node.declaration.id, node.declaration.id.start);
    }
    node.specifiers = [];
    node.source = null;
    if (this.options.ecmaVersion >= 16) {
      node.attributes = [];
    }
  } else {
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers(exports$1);
    if (this.eatContextual("from")) {
      if (this.type !== types$1.string) {
        this.unexpected();
      }
      node.source = this.parseExprAtom();
      if (this.options.ecmaVersion >= 16) {
        node.attributes = this.parseWithClause();
      }
    } else {
      for (var i2 = 0, list2 = node.specifiers; i2 < list2.length; i2 += 1) {
        var spec = list2[i2];
        this.checkUnreserved(spec.local);
        this.checkLocalExport(spec.local);
        if (spec.local.type === "Literal") {
          this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
        }
      }
      node.source = null;
      if (this.options.ecmaVersion >= 16) {
        node.attributes = [];
      }
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};
pp$8.parseExportDeclaration = function(node) {
  return this.parseStatement(null);
};
pp$8.parseExportDefaultDeclaration = function() {
  var isAsync;
  if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
    var fNode = this.startNode();
    this.next();
    if (isAsync) {
      this.next();
    }
    return this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
  } else if (this.type === types$1._class) {
    var cNode = this.startNode();
    return this.parseClass(cNode, "nullableID");
  } else {
    var declaration = this.parseMaybeAssign();
    this.semicolon();
    return declaration;
  }
};
pp$8.checkExport = function(exports$1, name, pos) {
  if (!exports$1) {
    return;
  }
  if (typeof name !== "string") {
    name = name.type === "Identifier" ? name.name : name.value;
  }
  if (hasOwn(exports$1, name)) {
    this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
  }
  exports$1[name] = true;
};
pp$8.checkPatternExport = function(exports$1, pat) {
  var type = pat.type;
  if (type === "Identifier") {
    this.checkExport(exports$1, pat, pat.start);
  } else if (type === "ObjectPattern") {
    for (var i2 = 0, list2 = pat.properties; i2 < list2.length; i2 += 1) {
      var prop = list2[i2];
      this.checkPatternExport(exports$1, prop);
    }
  } else if (type === "ArrayPattern") {
    for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
      var elt = list$1[i$1];
      if (elt) {
        this.checkPatternExport(exports$1, elt);
      }
    }
  } else if (type === "Property") {
    this.checkPatternExport(exports$1, pat.value);
  } else if (type === "AssignmentPattern") {
    this.checkPatternExport(exports$1, pat.left);
  } else if (type === "RestElement") {
    this.checkPatternExport(exports$1, pat.argument);
  }
};
pp$8.checkVariableExport = function(exports$1, decls) {
  if (!exports$1) {
    return;
  }
  for (var i2 = 0, list2 = decls; i2 < list2.length; i2 += 1) {
    var decl = list2[i2];
    this.checkPatternExport(exports$1, decl.id);
  }
};
pp$8.shouldParseExportStatement = function() {
  return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
};
pp$8.parseExportSpecifier = function(exports$1) {
  var node = this.startNode();
  node.local = this.parseModuleExportName();
  node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
  this.checkExport(
    exports$1,
    node.exported,
    node.exported.start
  );
  return this.finishNode(node, "ExportSpecifier");
};
pp$8.parseExportSpecifiers = function(exports$1) {
  var nodes = [], first = true;
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseExportSpecifier(exports$1));
  }
  return nodes;
};
pp$8.parseImport = function(node) {
  this.next();
  if (this.type === types$1.string) {
    node.specifiers = empty$1;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
  }
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};
pp$8.parseImportSpecifier = function() {
  var node = this.startNode();
  node.imported = this.parseModuleExportName();
  if (this.eatContextual("as")) {
    node.local = this.parseIdent();
  } else {
    this.checkUnreserved(node.imported);
    node.local = node.imported;
  }
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportSpecifier");
};
pp$8.parseImportDefaultSpecifier = function() {
  var node = this.startNode();
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportDefaultSpecifier");
};
pp$8.parseImportNamespaceSpecifier = function() {
  var node = this.startNode();
  this.next();
  this.expectContextual("as");
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportNamespaceSpecifier");
};
pp$8.parseImportSpecifiers = function() {
  var nodes = [], first = true;
  if (this.type === types$1.name) {
    nodes.push(this.parseImportDefaultSpecifier());
    if (!this.eat(types$1.comma)) {
      return nodes;
    }
  }
  if (this.type === types$1.star) {
    nodes.push(this.parseImportNamespaceSpecifier());
    return nodes;
  }
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseImportSpecifier());
  }
  return nodes;
};
pp$8.parseWithClause = function() {
  var nodes = [];
  if (!this.eat(types$1._with)) {
    return nodes;
  }
  this.expect(types$1.braceL);
  var attributeKeys = {};
  var first = true;
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var attr = this.parseImportAttribute();
    var keyName2 = attr.key.type === "Identifier" ? attr.key.name : attr.key.value;
    if (hasOwn(attributeKeys, keyName2)) {
      this.raiseRecoverable(attr.key.start, "Duplicate attribute key '" + keyName2 + "'");
    }
    attributeKeys[keyName2] = true;
    nodes.push(attr);
  }
  return nodes;
};
pp$8.parseImportAttribute = function() {
  var node = this.startNode();
  node.key = this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
  this.expect(types$1.colon);
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.value = this.parseExprAtom();
  return this.finishNode(node, "ImportAttribute");
};
pp$8.parseModuleExportName = function() {
  if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
    var stringLiteral2 = this.parseLiteral(this.value);
    if (loneSurrogate.test(stringLiteral2.value)) {
      this.raise(stringLiteral2.start, "An export name cannot include a lone surrogate.");
    }
    return stringLiteral2;
  }
  return this.parseIdent(true);
};
pp$8.adaptDirectivePrologue = function(statements) {
  for (var i2 = 0; i2 < statements.length && this.isDirectiveCandidate(statements[i2]); ++i2) {
    statements[i2].directive = statements[i2].expression.raw.slice(1, -1);
  }
};
pp$8.isDirectiveCandidate = function(statement) {
  return this.options.ecmaVersion >= 5 && statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && // Reject parenthesized strings.
  (this.input[statement.start] === '"' || this.input[statement.start] === "'");
};
var pp$7 = Parser2.prototype;
pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
        if (this.inAsync && node.name === "await") {
          this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
        }
        break;
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break;
      case "ObjectExpression":
        node.type = "ObjectPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        for (var i2 = 0, list2 = node.properties; i2 < list2.length; i2 += 1) {
          var prop = list2[i2];
          this.toAssignable(prop, isBinding);
          if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
            this.raise(prop.argument.start, "Unexpected token");
          }
        }
        break;
      case "Property":
        if (node.kind !== "init") {
          this.raise(node.key.start, "Object pattern can't contain getter or setter");
        }
        this.toAssignable(node.value, isBinding);
        break;
      case "ArrayExpression":
        node.type = "ArrayPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        this.toAssignableList(node.elements, isBinding);
        break;
      case "SpreadElement":
        node.type = "RestElement";
        this.toAssignable(node.argument, isBinding);
        if (node.argument.type === "AssignmentPattern") {
          this.raise(node.argument.start, "Rest elements cannot have a default value");
        }
        break;
      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isBinding);
        break;
      case "ParenthesizedExpression":
        this.toAssignable(node.expression, isBinding, refDestructuringErrors);
        break;
      case "ChainExpression":
        this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
        break;
      case "MemberExpression":
        if (!isBinding) {
          break;
        }
      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  } else if (refDestructuringErrors) {
    this.checkPatternErrors(refDestructuringErrors, true);
  }
  return node;
};
pp$7.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  for (var i2 = 0; i2 < end; i2++) {
    var elt = exprList[i2];
    if (elt) {
      this.toAssignable(elt, isBinding);
    }
  }
  if (end) {
    var last = exprList[end - 1];
    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier") {
      this.unexpected(last.argument.start);
    }
  }
  return exprList;
};
pp$7.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
  return this.finishNode(node, "SpreadElement");
};
pp$7.parseRestBinding = function() {
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion === 6 && this.type !== types$1.name) {
    this.unexpected();
  }
  node.argument = this.parseBindingAtom();
  return this.finishNode(node, "RestElement");
};
pp$7.parseBindingAtom = function() {
  if (this.options.ecmaVersion >= 6) {
    switch (this.type) {
      case types$1.bracketL:
        var node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(types$1.bracketR, true, true);
        return this.finishNode(node, "ArrayPattern");
      case types$1.braceL:
        return this.parseObj(true);
    }
  }
  return this.parseIdent();
};
pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowModifiers) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (first) {
      first = false;
    } else {
      this.expect(types$1.comma);
    }
    if (allowEmpty && this.type === types$1.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === types$1.ellipsis) {
      var rest = this.parseRestBinding();
      this.parseBindingListItem(rest);
      elts.push(rest);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      this.expect(close);
      break;
    } else {
      elts.push(this.parseAssignableListItem(allowModifiers));
    }
  }
  return elts;
};
pp$7.parseAssignableListItem = function(allowModifiers) {
  var elem = this.parseMaybeDefault(this.start, this.startLoc);
  this.parseBindingListItem(elem);
  return elem;
};
pp$7.parseBindingListItem = function(param) {
  return param;
};
pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) {
    return left;
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};
pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  var isBind = bindingType !== BIND_NONE;
  switch (expr.type) {
    case "Identifier":
      if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
        this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      }
      if (isBind) {
        if (bindingType === BIND_LEXICAL && expr.name === "let") {
          this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
        }
        if (checkClashes) {
          if (hasOwn(checkClashes, expr.name)) {
            this.raiseRecoverable(expr.start, "Argument name clash");
          }
          checkClashes[expr.name] = true;
        }
        if (bindingType !== BIND_OUTSIDE) {
          this.declareName(expr.name, bindingType, expr.start);
        }
      }
      break;
    case "ChainExpression":
      this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
      break;
    case "MemberExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding member expression");
      }
      break;
    case "ParenthesizedExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding parenthesized expression");
      }
      return this.checkLValSimple(expr.expression, bindingType, checkClashes);
    default:
      this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
  }
};
pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "ObjectPattern":
      for (var i2 = 0, list2 = expr.properties; i2 < list2.length; i2 += 1) {
        var prop = list2[i2];
        this.checkLValInnerPattern(prop, bindingType, checkClashes);
      }
      break;
    case "ArrayPattern":
      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
        var elem = list$1[i$1];
        if (elem) {
          this.checkLValInnerPattern(elem, bindingType, checkClashes);
        }
      }
      break;
    default:
      this.checkLValSimple(expr, bindingType, checkClashes);
  }
};
pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "Property":
      this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
      break;
    case "AssignmentPattern":
      this.checkLValPattern(expr.left, bindingType, checkClashes);
      break;
    case "RestElement":
      this.checkLValPattern(expr.argument, bindingType, checkClashes);
      break;
    default:
      this.checkLValPattern(expr, bindingType, checkClashes);
  }
};
var TokContext = function TokContext2(token, isExpr, preserveSpace, override, generator) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
  this.generator = !!generator;
};
var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function(p) {
    return p.tryReadTemplateToken();
  }),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
};
var pp$6 = Parser2.prototype;
pp$6.initialContext = function() {
  return [types.b_stat];
};
pp$6.curContext = function() {
  return this.context[this.context.length - 1];
};
pp$6.braceIsBlock = function(prevType) {
  var parent = this.curContext();
  if (parent === types.f_expr || parent === types.f_stat) {
    return true;
  }
  if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr)) {
    return !parent.isExpr;
  }
  if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed) {
    return lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
  }
  if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow) {
    return true;
  }
  if (prevType === types$1.braceL) {
    return parent === types.b_stat;
  }
  if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name) {
    return false;
  }
  return !this.exprAllowed;
};
pp$6.inGeneratorContext = function() {
  for (var i2 = this.context.length - 1; i2 >= 1; i2--) {
    var context = this.context[i2];
    if (context.token === "function") {
      return context.generator;
    }
  }
  return false;
};
pp$6.updateContext = function(prevType) {
  var update, type = this.type;
  if (type.keyword && prevType === types$1.dot) {
    this.exprAllowed = false;
  } else if (update = type.updateContext) {
    update.call(this, prevType);
  } else {
    this.exprAllowed = type.beforeExpr;
  }
};
pp$6.overrideContext = function(tokenCtx) {
  if (this.curContext() !== tokenCtx) {
    this.context[this.context.length - 1] = tokenCtx;
  }
};
types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
  if (this.context.length === 1) {
    this.exprAllowed = true;
    return;
  }
  var out2 = this.context.pop();
  if (out2 === types.b_stat && this.curContext().token === "function") {
    out2 = this.context.pop();
  }
  this.exprAllowed = !out2.isExpr;
};
types$1.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};
types$1.dollarBraceL.updateContext = function() {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};
types$1.parenL.updateContext = function(prevType) {
  var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};
types$1.incDec.updateContext = function() {
};
types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== types$1._else && !(prevType === types$1.semi && this.curContext() !== types.p_stat) && !(prevType === types$1._return && lineBreak2.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat)) {
    this.context.push(types.f_expr);
  } else {
    this.context.push(types.f_stat);
  }
  this.exprAllowed = false;
};
types$1.colon.updateContext = function() {
  if (this.curContext().token === "function") {
    this.context.pop();
  }
  this.exprAllowed = true;
};
types$1.backQuote.updateContext = function() {
  if (this.curContext() === types.q_tmpl) {
    this.context.pop();
  } else {
    this.context.push(types.q_tmpl);
  }
  this.exprAllowed = false;
};
types$1.star.updateContext = function(prevType) {
  if (prevType === types$1._function) {
    var index = this.context.length - 1;
    if (this.context[index] === types.f_expr) {
      this.context[index] = types.f_expr_gen;
    } else {
      this.context[index] = types.f_gen;
    }
  }
  this.exprAllowed = true;
};
types$1.name.updateContext = function(prevType) {
  var allowed = false;
  if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
    if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
      allowed = true;
    }
  }
  this.exprAllowed = allowed;
};
var pp$5 = Parser2.prototype;
pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
    return;
  }
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
    return;
  }
  var key = prop.key;
  var name;
  switch (key.type) {
    case "Identifier":
      name = key.name;
      break;
    case "Literal":
      name = String(key.value);
      break;
    default:
      return;
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) {
        if (refDestructuringErrors) {
          if (refDestructuringErrors.doubleProto < 0) {
            refDestructuringErrors.doubleProto = key.start;
          }
        } else {
          this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
        }
      }
      propHash.proto = true;
    }
    return;
  }
  name = "$" + name;
  var other = propHash[name];
  if (other) {
    var redefinition;
    if (kind === "init") {
      redefinition = this.strict && other.init || other.get || other.set;
    } else {
      redefinition = other.init || other[kind];
    }
    if (redefinition) {
      this.raiseRecoverable(key.start, "Redefinition of property");
    }
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};
pp$5.parseExpression = function(forInit, refDestructuringErrors) {
  var this$1$1 = this;
  return this.catchStackOverflow(function() {
    var startPos = this$1$1.start, startLoc = this$1$1.startLoc;
    var expr = this$1$1.parseMaybeAssign(forInit, refDestructuringErrors);
    if (this$1$1.type === types$1.comma) {
      var node = this$1$1.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this$1$1.eat(types$1.comma)) {
        node.expressions.push(this$1$1.parseMaybeAssign(forInit, refDestructuringErrors));
      }
      return this$1$1.finishNode(node, "SequenceExpression");
    }
    return expr;
  });
};
pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) {
      return this.parseYield(forInit);
    } else {
      this.exprAllowed = false;
    }
  }
  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    oldDoubleProto = refDestructuringErrors.doubleProto;
    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors();
    ownDestructuringErrors = true;
  }
  var startPos = this.start, startLoc = this.startLoc;
  if (this.type === types$1.parenL || this.type === types$1.name) {
    this.potentialArrowAt = this.start;
    this.potentialArrowInForAwait = forInit === "await";
  }
  var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
  if (afterLeftParse) {
    left = afterLeftParse.call(this, left, startPos, startLoc);
  }
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    if (this.type === types$1.eq) {
      left = this.toAssignable(left, false, refDestructuringErrors);
    }
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
      if (refDestructuringErrors.shorthandAssign >= left.start) {
        refDestructuringErrors.shorthandAssign = -1;
      }
      if (refDestructuringErrors.doubleProto >= left.start) {
        refDestructuringErrors.doubleProto = -1;
      }
    }
    if (this.type === types$1.eq) {
      this.checkLValPattern(left);
    } else {
      this.checkLValSimple(left);
    }
    node.left = left;
    this.next();
    node.right = this.parseMaybeAssign(forInit);
    if (oldDoubleProto > -1) {
      refDestructuringErrors.doubleProto = oldDoubleProto;
    }
    return this.finishNode(node, "AssignmentExpression");
  } else {
    if (ownDestructuringErrors) {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
  }
  if (oldParenAssign > -1) {
    refDestructuringErrors.parenthesizedAssign = oldParenAssign;
  }
  if (oldTrailingComma > -1) {
    refDestructuringErrors.trailingComma = oldTrailingComma;
  }
  return left;
};
pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprOps(forInit, refDestructuringErrors);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  if (!(expr.type === "ArrowFunctionExpression" && expr.start === startPos) && this.eat(types$1.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(types$1.colon);
    node.alternate = this.parseMaybeAssign(forInit);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};
pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit);
};
pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
  var prec = this.type.binop;
  if (prec != null && (!forInit || this.type !== types$1._in)) {
    if (prec > minPrec) {
      var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
      var coalesce = this.type === types$1.coalesce;
      if (coalesce) {
        prec = types$1.logicalAND.binop;
      }
      var op = this.value;
      this.next();
      var startPos = this.start, startLoc = this.startLoc;
      var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
      if (logical && this.type === types$1.coalesce || coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND)) {
        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
      }
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);
    }
  }
  return left;
};
pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {
  if (right.type === "PrivateIdentifier") {
    this.raise(right.start, "Private identifier can only be left side of binary expression");
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.operator = op;
  node.right = right;
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
};
pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
  var startPos = this.start, startLoc = this.startLoc, expr;
  if (this.isContextual("await") && this.canAwait) {
    expr = this.parseAwait(forInit);
    sawUnary = true;
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === types$1.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true, update, forInit);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) {
      this.checkLValSimple(node.argument);
    } else if (this.strict && node.operator === "delete" && isLocalVariableAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
    } else if (node.operator === "delete" && isPrivateFieldAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Private fields can not be deleted");
    } else {
      sawUnary = true;
    }
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (!sawUnary && this.type === types$1.privateId) {
    if ((forInit || this.privateNameStack.length === 0) && this.options.checkPrivateFields) {
      this.unexpected();
    }
    expr = this.parsePrivateIdent();
    if (this.type !== types$1._in) {
      this.unexpected();
    }
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.operator = this.value;
      node$1.prefix = false;
      node$1.argument = expr;
      this.checkLValSimple(expr);
      this.next();
      expr = this.finishNode(node$1, "UpdateExpression");
    }
  }
  if (!incDec && !(expr.type === "ArrowFunctionExpression" && expr.start === startPos) && this.eat(types$1.starstar)) {
    if (sawUnary) {
      this.unexpected(this.lastTokStart);
    } else {
      return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false);
    }
  } else {
    return expr;
  }
};
function isLocalVariableAccess(node) {
  return node.type === "Identifier" || node.type === "ParenthesizedExpression" && isLocalVariableAccess(node.expression);
}
function isPrivateFieldAccess(node) {
  return node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" || node.type === "ChainExpression" && isPrivateFieldAccess(node.expression) || node.type === "ParenthesizedExpression" && isPrivateFieldAccess(node.expression);
}
pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
  var startPos = this.start, startLoc = this.startLoc;
  var oldDoubleProto = -1, oldShorthandAssign = -1;
  if (refDestructuringErrors) {
    oldDoubleProto = refDestructuringErrors.doubleProto;
    oldShorthandAssign = refDestructuringErrors.shorthandAssign;
    refDestructuringErrors.doubleProto = refDestructuringErrors.shorthandAssign = -1;
  }
  var expr = this.parseExprAtom(refDestructuringErrors, forInit);
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
    return expr;
  }
  var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
  if (refDestructuringErrors) {
    if (result.end > expr.end) {
      this.checkExpressionErrors(refDestructuringErrors, true);
      if (refDestructuringErrors.parenthesizedAssign >= result.start) {
        refDestructuringErrors.parenthesizedAssign = -1;
      }
      if (refDestructuringErrors.parenthesizedBind >= result.start) {
        refDestructuringErrors.parenthesizedBind = -1;
      }
      if (refDestructuringErrors.trailingComma >= result.start) {
        refDestructuringErrors.trailingComma = -1;
      }
    }
    if (oldDoubleProto > -1) {
      refDestructuringErrors.doubleProto = oldDoubleProto;
    }
    if (oldShorthandAssign > -1) {
      refDestructuringErrors.shorthandAssign = oldShorthandAssign;
    }
  }
  return result;
};
pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" && this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && this.potentialArrowAt === base.start;
  var optionalChained = false;
  while (true) {
    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);
    if (element.optional) {
      optionalChained = true;
    }
    if (element.end === base.end || element.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        var chainNode = this.startNodeAt(startPos, startLoc);
        chainNode.expression = element;
        element = this.finishNode(chainNode, "ChainExpression");
      }
      return element;
    }
    base = element;
    maybeAsyncArrow = false;
  }
};
pp$5.shouldParseAsyncArrow = function() {
  return !this.canInsertSemicolon() && this.eat(types$1.arrow);
};
pp$5.parseSubscriptAsyncArrow = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit);
};
pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
  var optionalSupported = this.options.ecmaVersion >= 11;
  var optional = optionalSupported && this.eat(types$1.questionDot);
  if (noCalls && optional) {
    this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
  }
  var computed = this.eat(types$1.bracketL);
  if (computed || optional && this.type !== types$1.parenL && this.type !== types$1.backQuote || this.eat(types$1.dot)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    if (computed) {
      node.property = this.parseExpression();
      this.expect(types$1.bracketR);
    } else if (this.type === types$1.privateId && base.type !== "Super") {
      node.property = this.parsePrivateIdent();
    } else {
      node.property = this.parseIdent(this.options.allowReserved !== "never");
    }
    node.computed = !!computed;
    if (optionalSupported) {
      node.optional = optional;
    }
    base = this.finishNode(node, "MemberExpression");
  } else if (!noCalls && this.eat(types$1.parenL)) {
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      if (this.awaitIdentPos > 0) {
        this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
      }
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    var node$1 = this.startNodeAt(startPos, startLoc);
    node$1.callee = base;
    node$1.arguments = exprList;
    if (optionalSupported) {
      node$1.optional = optional;
    }
    base = this.finishNode(node$1, "CallExpression");
  } else if (this.type === types$1.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
    }
    var node$2 = this.startNodeAt(startPos, startLoc);
    node$2.tag = base;
    node$2.quasi = this.parseTemplate({ isTagged: true });
    base = this.finishNode(node$2, "TaggedTemplateExpression");
  }
  return base;
};
pp$5.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {
  if (this.type === types$1.slash) {
    this.readRegexp();
  }
  var node, canBeArrow = this.potentialArrowAt === this.start;
  switch (this.type) {
    case types$1._super:
      if (!this.allowSuper) {
        this.raise(this.start, "'super' keyword outside a method");
      }
      node = this.startNode();
      this.next();
      if (this.type === types$1.parenL && !this.allowDirectSuper) {
        this.raise(node.start, "super() call outside constructor of a subclass");
      }
      if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL) {
        this.unexpected();
      }
      return this.finishNode(node, "Super");
    case types$1._this:
      node = this.startNode();
      this.next();
      return this.finishNode(node, "ThisExpression");
    case types$1.name:
      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
      var id = this.parseIdent(false);
      if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
        this.overrideContext(types.f_expr);
        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit);
      }
      if (canBeArrow && !this.canInsertSemicolon()) {
        if (this.eat(types$1.arrow)) {
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit);
        }
        if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types$1.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
          id = this.parseIdent(false);
          if (this.canInsertSemicolon() || !this.eat(types$1.arrow)) {
            this.unexpected();
          }
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit);
        }
      }
      return id;
    case types$1.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;
    case types$1.num:
    case types$1.string:
      return this.parseLiteral(this.value);
    case types$1._null:
    case types$1._true:
    case types$1._false:
      node = this.startNode();
      node.value = this.type === types$1._null ? null : this.type === types$1._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");
    case types$1.parenL:
      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
      if (refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
          refDestructuringErrors.parenthesizedAssign = start;
        }
        if (refDestructuringErrors.parenthesizedBind < 0) {
          refDestructuringErrors.parenthesizedBind = start;
        }
      }
      return expr;
    case types$1.bracketL:
      node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
      return this.finishNode(node, "ArrayExpression");
    case types$1.braceL:
      this.overrideContext(types.b_expr);
      return this.parseObj(false, refDestructuringErrors);
    case types$1._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, 0);
    case types$1._class:
      return this.parseClass(this.startNode(), false);
    case types$1._new:
      return this.parseNew();
    case types$1.backQuote:
      return this.parseTemplate();
    case types$1._import:
      if (this.options.ecmaVersion >= 11) {
        return this.parseExprImport(forNew);
      } else {
        return this.unexpected();
      }
    default:
      return this.parseExprAtomDefault();
  }
};
pp$5.parseExprAtomDefault = function() {
  this.unexpected();
};
pp$5.parseExprImport = function(forNew) {
  var node = this.startNode();
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword import");
  }
  this.next();
  if (this.type === types$1.parenL && !forNew) {
    return this.parseDynamicImport(node);
  } else if (this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "import";
    node.meta = this.finishNode(meta, "Identifier");
    return this.parseImportMeta(node);
  } else {
    this.unexpected();
  }
};
pp$5.parseDynamicImport = function(node) {
  this.next();
  node.source = this.parseMaybeAssign();
  if (this.options.ecmaVersion >= 16) {
    if (!this.eat(types$1.parenR)) {
      this.expect(types$1.comma);
      if (!this.afterTrailingComma(types$1.parenR)) {
        node.options = this.parseMaybeAssign();
        if (!this.eat(types$1.parenR)) {
          this.expect(types$1.comma);
          if (!this.afterTrailingComma(types$1.parenR)) {
            this.unexpected();
          }
        }
      } else {
        node.options = null;
      }
    } else {
      node.options = null;
    }
  } else {
    if (!this.eat(types$1.parenR)) {
      var errorPos = this.start;
      if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
        this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
      } else {
        this.unexpected(errorPos);
      }
    }
  }
  return this.finishNode(node, "ImportExpression");
};
pp$5.parseImportMeta = function(node) {
  this.next();
  var containsEsc = this.containsEsc;
  node.property = this.parseIdent(true);
  if (node.property.name !== "meta") {
    this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
  }
  if (containsEsc) {
    this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
  }
  if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere) {
    this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
  }
  return this.finishNode(node, "MetaProperty");
};
pp$5.parseLiteral = function(value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
    node.bigint = node.value != null ? node.value.toString() : node.raw.slice(0, -1).replace(/_/g, "");
  }
  this.next();
  return this.finishNode(node, "Literal");
};
pp$5.parseParenExpression = function() {
  this.expect(types$1.parenL);
  var val = this.parseExpression();
  this.expect(types$1.parenR);
  return val;
};
pp$5.shouldParseArrow = function(exprList) {
  return !this.canInsertSemicolon();
};
pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();
    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    var exprList = [], first = true, lastIsComma = false;
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    this.yieldPos = 0;
    this.awaitPos = 0;
    while (this.type !== types$1.parenR) {
      first ? first = false : this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
        lastIsComma = true;
        break;
      } else if (this.type === types$1.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRestBinding()));
        if (this.type === types$1.comma) {
          this.raiseRecoverable(
            this.start,
            "Comma is not permitted after the rest element"
          );
        }
        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
      }
    }
    var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
    this.expect(types$1.parenR);
    if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(types$1.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      return this.parseParenArrowList(startPos, startLoc, exprList, forInit);
    }
    if (!exprList.length || lastIsComma) {
      this.unexpected(this.lastTokStart);
    }
    if (spreadStart) {
      this.unexpected(spreadStart);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }
  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};
pp$5.parseParenItem = function(item) {
  return item;
};
pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit);
};
var empty = [];
pp$5.parseNew = function() {
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword new");
  }
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion >= 6 && this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "new";
    node.meta = this.finishNode(meta, "Identifier");
    this.next();
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") {
      this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
    }
    if (containsEsc) {
      this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
    }
    if (!this.allowNewDotTarget) {
      this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block");
    }
    return this.finishNode(node, "MetaProperty");
  }
  var startPos = this.start, startLoc = this.startLoc;
  node.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), startPos, startLoc, true, false);
  if (node.callee.type === "Super") {
    this.raiseRecoverable(startPos, "Invalid use of 'super'");
  }
  if (this.eat(types$1.parenL)) {
    node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false);
  } else {
    node.arguments = empty;
  }
  return this.finishNode(node, "NewExpression");
};
pp$5.parseTemplateElement = function(ref2) {
  var isTagged = ref2.isTagged;
  var elem = this.startNode();
  if (this.type === types$1.invalidTemplate) {
    if (!isTagged) {
      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    }
    elem.value = {
      raw: this.value.replace(/\r\n?/g, "\n"),
      cooked: null
    };
  } else {
    elem.value = {
      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
      cooked: this.value
    };
  }
  this.next();
  elem.tail = this.type === types$1.backQuote;
  return this.finishNode(elem, "TemplateElement");
};
pp$5.parseTemplate = function(ref2) {
  if (ref2 === void 0) ref2 = {};
  var isTagged = ref2.isTagged;
  if (isTagged === void 0) isTagged = false;
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement({ isTagged });
  node.quasis = [curElt];
  while (!curElt.tail) {
    if (this.type === types$1.eof) {
      this.raise(this.pos, "Unterminated template literal");
    }
    this.expect(types$1.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(types$1.braceR);
    node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral");
};
pp$5.isAsyncProp = function(prop) {
  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types$1.star) && !lineBreak2.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$5.parseObj = function(isPattern, refDestructuringErrors) {
  var node = this.startNode(), first = true, propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    if (!isPattern) {
      this.checkPropClash(prop, propHash, refDestructuringErrors);
    }
    node.properties.push(prop);
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};
pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
  if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
    if (isPattern) {
      prop.argument = this.parseIdent(false);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      return this.finishNode(prop, "RestElement");
    }
    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
      refDestructuringErrors.trailingComma = this.start;
    }
    return this.finishNode(prop, "SpreadElement");
  }
  if (this.options.ecmaVersion >= 6) {
    prop.method = false;
    prop.shorthand = false;
    if (isPattern || refDestructuringErrors) {
      startPos = this.start;
      startLoc = this.startLoc;
    }
    if (!isPattern) {
      isGenerator = this.eat(types$1.star);
    }
  }
  var containsEsc = this.containsEsc;
  this.parsePropertyName(prop);
  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    isAsync = true;
    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
    this.parsePropertyName(prop);
  } else {
    isAsync = false;
  }
  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
  return this.finishNode(prop, "Property");
};
pp$5.parseGetterSetter = function(prop) {
  var kind = prop.key.name;
  this.parsePropertyName(prop);
  prop.value = this.parseMethod(false);
  prop.kind = kind;
  var paramCount = prop.kind === "get" ? 0 : 1;
  if (prop.value.params.length !== paramCount) {
    var start = prop.value.start;
    if (prop.kind === "get") {
      this.raiseRecoverable(start, "getter should have no params");
    } else {
      this.raiseRecoverable(start, "setter should have exactly one param");
    }
  } else {
    if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
      this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
    }
  }
};
pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
  if ((isGenerator || isAsync) && this.type === types$1.colon) {
    this.unexpected();
  }
  if (this.eat(types$1.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
    if (isPattern) {
      this.unexpected();
    }
    prop.method = true;
    prop.value = this.parseMethod(isGenerator, isAsync);
    prop.kind = "init";
  } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.parseGetterSetter(prop);
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.checkUnreserved(prop.key);
    if (prop.key.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = startPos;
    }
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else if (this.type === types$1.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0) {
        refDestructuringErrors.shorthandAssign = this.start;
      }
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else {
      prop.value = this.copyNode(prop.key);
    }
    prop.kind = "init";
    prop.shorthand = true;
  } else {
    this.unexpected();
  }
};
pp$5.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(types$1.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types$1.bracketR);
      return prop.key;
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
};
pp$5.initFunction = function(node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) {
    node.generator = node.expression = false;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = false;
  }
};
pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
  this.parseFunctionBody(node, false, true, false);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "FunctionExpression");
};
pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
  this.initFunction(node);
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "ArrowFunctionExpression");
};
pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
  var isExpression = isArrowFunction && this.type !== types$1.braceL;
  var oldStrict = this.strict, useStrict = false;
  if (isExpression) {
    node.body = this.parseMaybeAssign(forInit);
    node.expression = true;
    this.checkParams(node, false);
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end);
      if (useStrict && nonSimple) {
        this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
      }
    }
    var oldLabels = this.labels;
    this.labels = [];
    if (useStrict) {
      this.strict = true;
    }
    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    if (this.strict && node.id) {
      this.checkLValSimple(node.id, BIND_OUTSIDE);
    }
    node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
    node.expression = false;
    this.adaptDirectivePrologue(node.body.body);
    this.labels = oldLabels;
  }
  this.exitScope();
};
pp$5.isSimpleParamList = function(params) {
  for (var i2 = 0, list2 = params; i2 < list2.length; i2 += 1) {
    var param = list2[i2];
    if (param.type !== "Identifier") {
      return false;
    }
  }
  return true;
};
pp$5.checkParams = function(node, allowDuplicates) {
  var nameHash = /* @__PURE__ */ Object.create(null);
  for (var i2 = 0, list2 = node.params; i2 < list2.length; i2 += 1) {
    var param = list2[i2];
    this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
  }
};
pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (!first) {
      this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) {
        break;
      }
    } else {
      first = false;
    }
    var elt = void 0;
    if (allowEmpty && this.type === types$1.comma) {
      elt = null;
    } else if (this.type === types$1.ellipsis) {
      elt = this.parseSpread(refDestructuringErrors);
      if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
    } else {
      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    }
    elts.push(elt);
  }
  return elts;
};
pp$5.checkUnreserved = function(ref2) {
  var start = ref2.start;
  var end = ref2.end;
  var name = ref2.name;
  if (this.inGenerator && name === "yield") {
    this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
  }
  if (this.inAsync && name === "await") {
    this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
  }
  if (!(this.currentThisScope().flags & SCOPE_VAR) && name === "arguments") {
    this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer");
  }
  if (this.inClassStaticBlock && (name === "arguments" || name === "await")) {
    this.raise(start, "Cannot use " + name + " in class static initialization block");
  }
  if (this.keywords.test(name)) {
    this.raise(start, "Unexpected keyword '" + name + "'");
  }
  if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
    return;
  }
  var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
  if (re.test(name)) {
    if (!this.inAsync && name === "await") {
      this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
    }
    this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
  }
};
pp$5.parseIdent = function(liberal) {
  var node = this.parseIdentNode();
  this.next(!!liberal);
  this.finishNode(node, "Identifier");
  if (!liberal) {
    this.checkUnreserved(node);
    if (node.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = node.start;
    }
  }
  return node;
};
pp$5.parseIdentNode = function() {
  var node = this.startNode();
  if (this.type === types$1.name) {
    node.name = this.value;
  } else if (this.type.keyword) {
    node.name = this.type.keyword;
    if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop();
    }
    this.type = types$1.name;
  } else {
    this.unexpected();
  }
  return node;
};
pp$5.parsePrivateIdent = function() {
  var node = this.startNode();
  if (this.type === types$1.privateId) {
    node.name = this.value;
  } else {
    this.unexpected();
  }
  this.next();
  this.finishNode(node, "PrivateIdentifier");
  if (this.options.checkPrivateFields) {
    if (this.privateNameStack.length === 0) {
      this.raise(node.start, "Private field '#" + node.name + "' must be declared in an enclosing class");
    } else {
      this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
    }
  }
  return node;
};
pp$5.parseYield = function(forInit) {
  if (!this.yieldPos) {
    this.yieldPos = this.start;
  }
  var node = this.startNode();
  this.next();
  if (this.type === types$1.semi || this.canInsertSemicolon() || this.type !== types$1.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(types$1.star);
    node.argument = this.parseMaybeAssign(forInit);
  }
  return this.finishNode(node, "YieldExpression");
};
pp$5.parseAwait = function(forInit) {
  if (!this.awaitPos) {
    this.awaitPos = this.start;
  }
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeUnary(null, true, false, forInit);
  return this.finishNode(node, "AwaitExpression");
};
var pp$4 = Parser2.prototype;
pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  if (this.sourceFile) {
    message += " in " + this.sourceFile;
  }
  var err = new SyntaxError(message);
  err.pos = pos;
  err.loc = loc;
  err.raisedAt = this.pos;
  throw err;
};
pp$4.raiseRecoverable = pp$4.raise;
pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart);
  }
};
var pp$3 = Parser2.prototype;
var Scope = function Scope2(flags) {
  this.flags = flags;
  this.var = [];
  this.lexical = [];
  this.functions = [];
};
pp$3.enterScope = function(flags) {
  this.scopeStack.push(new Scope(flags));
};
pp$3.exitScope = function() {
  this.scopeStack.pop();
};
pp$3.treatFunctionsAsVarInScope = function(scope) {
  return scope.flags & SCOPE_FUNCTION || !this.inModule && scope.flags & SCOPE_TOP;
};
pp$3.declareName = function(name, bindingType, pos) {
  var redeclared = false;
  if (bindingType === BIND_LEXICAL) {
    var scope = this.currentScope();
    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    scope.lexical.push(name);
    if (this.inModule && scope.flags & SCOPE_TOP) {
      delete this.undefinedExports[name];
    }
  } else if (bindingType === BIND_SIMPLE_CATCH) {
    var scope$1 = this.currentScope();
    scope$1.lexical.push(name);
  } else if (bindingType === BIND_FUNCTION) {
    var scope$2 = this.currentScope();
    if (this.treatFunctionsAsVar) {
      redeclared = scope$2.lexical.indexOf(name) > -1;
    } else {
      redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
    }
    scope$2.functions.push(name);
  } else {
    for (var i2 = this.scopeStack.length - 1; i2 >= 0; --i2) {
      var scope$3 = this.scopeStack[i2];
      if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
        redeclared = true;
        break;
      }
      scope$3.var.push(name);
      if (this.inModule && scope$3.flags & SCOPE_TOP) {
        delete this.undefinedExports[name];
      }
      if (scope$3.flags & SCOPE_VAR) {
        break;
      }
    }
  }
  if (redeclared) {
    this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
  }
};
pp$3.checkLocalExport = function(id) {
  if (this.scopeStack[0].lexical.indexOf(id.name) === -1 && this.scopeStack[0].var.indexOf(id.name) === -1) {
    this.undefinedExports[id.name] = id;
  }
};
pp$3.currentScope = function() {
  return this.scopeStack[this.scopeStack.length - 1];
};
pp$3.currentVarScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK)) {
      return scope;
    }
  }
};
pp$3.currentThisScope = function() {
  for (var i2 = this.scopeStack.length - 1; ; i2--) {
    var scope = this.scopeStack[i2];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) && !(scope.flags & SCOPE_ARROW)) {
      return scope;
    }
  }
};
var Node = function Node2(parser, pos, loc) {
  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser.options.locations) {
    this.loc = new SourceLocation(parser, loc);
  }
  if (parser.options.directSourceFile) {
    this.sourceFile = parser.options.directSourceFile;
  }
  if (parser.options.ranges) {
    this.range = [pos, 0];
  }
};
var pp$2 = Parser2.prototype;
pp$2.startNode = function() {
  return new Node(this, this.start, this.startLoc);
};
pp$2.startNodeAt = function(pos, loc) {
  return new Node(this, pos, loc);
};
function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations) {
    node.loc.end = loc;
  }
  if (this.options.ranges) {
    node.range[1] = pos;
  }
  return node;
}
pp$2.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
};
pp$2.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc);
};
pp$2.copyNode = function(node) {
  var newNode = new Node(this, node.start, this.startLoc);
  for (var prop in node) {
    newNode[prop] = node[prop];
  }
  return newNode;
};
var scriptValuesAddedInUnicode = "Berf Beria_Erfe Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sidetic Sidt Sunu Sunuwar Tai_Yo Tayo Todhri Todr Tolong_Siki Tols Tulu_Tigalari Tutg Unknown Zzzz";
var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
var ecma11BinaryProperties = ecma10BinaryProperties;
var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
var ecma13BinaryProperties = ecma12BinaryProperties;
var ecma14BinaryProperties = ecma13BinaryProperties;
var unicodeBinaryProperties = {
  9: ecma9BinaryProperties,
  10: ecma10BinaryProperties,
  11: ecma11BinaryProperties,
  12: ecma12BinaryProperties,
  13: ecma13BinaryProperties,
  14: ecma14BinaryProperties
};
var ecma14BinaryPropertiesOfStrings = "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji";
var unicodeBinaryPropertiesOfStrings = {
  9: "",
  10: "",
  11: "",
  12: "",
  13: "",
  14: ecma14BinaryPropertiesOfStrings
};
var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
var ecma14ScriptValues = ecma13ScriptValues + " " + scriptValuesAddedInUnicode;
var unicodeScriptValues = {
  9: ecma9ScriptValues,
  10: ecma10ScriptValues,
  11: ecma11ScriptValues,
  12: ecma12ScriptValues,
  13: ecma13ScriptValues,
  14: ecma14ScriptValues
};
var data = {};
function buildUnicodeData(ecmaVersion2) {
  var d = data[ecmaVersion2] = {
    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion2] + " " + unicodeGeneralCategoryValues),
    binaryOfStrings: wordsRegexp(unicodeBinaryPropertiesOfStrings[ecmaVersion2]),
    nonBinary: {
      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
      Script: wordsRegexp(unicodeScriptValues[ecmaVersion2])
    }
  };
  d.nonBinary.Script_Extensions = d.nonBinary.Script;
  d.nonBinary.gc = d.nonBinary.General_Category;
  d.nonBinary.sc = d.nonBinary.Script;
  d.nonBinary.scx = d.nonBinary.Script_Extensions;
}
for (i = 0, list = [9, 10, 11, 12, 13, 14]; i < list.length; i += 1) {
  ecmaVersion = list[i];
  buildUnicodeData(ecmaVersion);
}
var ecmaVersion;
var i;
var list;
var pp$1 = Parser2.prototype;
var BranchID = function BranchID2(parent, base) {
  this.parent = parent;
  this.base = base || this;
};
BranchID.prototype.separatedFrom = function separatedFrom(alt) {
  for (var self = this; self; self = self.parent) {
    for (var other = alt; other; other = other.parent) {
      if (self.base === other.base && self !== other) {
        return true;
      }
    }
  }
  return false;
};
BranchID.prototype.sibling = function sibling() {
  return new BranchID(this.parent, this.base);
};
var RegExpValidationState = function RegExpValidationState2(parser) {
  this.parser = parser;
  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "") + (parser.options.ecmaVersion >= 15 ? "v" : "");
  this.unicodeProperties = data[parser.options.ecmaVersion >= 14 ? 14 : parser.options.ecmaVersion];
  this.source = "";
  this.flags = "";
  this.start = 0;
  this.switchU = false;
  this.switchV = false;
  this.switchN = false;
  this.pos = 0;
  this.lastIntValue = 0;
  this.lastStringValue = "";
  this.lastAssertionIsQuantifiable = false;
  this.numCapturingParens = 0;
  this.maxBackReference = 0;
  this.groupNames = /* @__PURE__ */ Object.create(null);
  this.backReferenceNames = [];
  this.branchID = null;
};
RegExpValidationState.prototype.reset = function reset(start, pattern, flags) {
  var unicodeSets = flags.indexOf("v") !== -1;
  var unicode = flags.indexOf("u") !== -1;
  this.start = start | 0;
  this.source = pattern + "";
  this.flags = flags;
  if (unicodeSets && this.parser.options.ecmaVersion >= 15) {
    this.switchU = true;
    this.switchV = true;
    this.switchN = true;
  } else {
    this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
    this.switchV = false;
    this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
  }
};
RegExpValidationState.prototype.raise = function raise(message) {
  this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
};
RegExpValidationState.prototype.at = function at(i2, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l = s.length;
  if (i2 >= l) {
    return -1;
  }
  var c = s.charCodeAt(i2);
  if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i2 + 1 >= l) {
    return c;
  }
  var next = s.charCodeAt(i2 + 1);
  return next >= 56320 && next <= 57343 ? (c << 10) + next - 56613888 : c;
};
RegExpValidationState.prototype.nextIndex = function nextIndex(i2, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l = s.length;
  if (i2 >= l) {
    return l;
  }
  var c = s.charCodeAt(i2), next;
  if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i2 + 1 >= l || (next = s.charCodeAt(i2 + 1)) < 56320 || next > 57343) {
    return i2 + 1;
  }
  return i2 + 2;
};
RegExpValidationState.prototype.current = function current(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.pos, forceU);
};
RegExpValidationState.prototype.lookahead = function lookahead(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.nextIndex(this.pos, forceU), forceU);
};
RegExpValidationState.prototype.advance = function advance(forceU) {
  if (forceU === void 0) forceU = false;
  this.pos = this.nextIndex(this.pos, forceU);
};
RegExpValidationState.prototype.eat = function eat(ch, forceU) {
  if (forceU === void 0) forceU = false;
  if (this.current(forceU) === ch) {
    this.advance(forceU);
    return true;
  }
  return false;
};
RegExpValidationState.prototype.eatChars = function eatChars(chs, forceU) {
  if (forceU === void 0) forceU = false;
  var pos = this.pos;
  for (var i2 = 0, list2 = chs; i2 < list2.length; i2 += 1) {
    var ch = list2[i2];
    var current2 = this.at(pos, forceU);
    if (current2 === -1 || current2 !== ch) {
      return false;
    }
    pos = this.nextIndex(pos, forceU);
  }
  this.pos = pos;
  return true;
};
pp$1.validateRegExpFlags = function(state) {
  var validFlags = state.validFlags;
  var flags = state.flags;
  var u = false;
  var v = false;
  for (var i2 = 0; i2 < flags.length; i2++) {
    var flag = flags.charAt(i2);
    if (validFlags.indexOf(flag) === -1) {
      this.raise(state.start, "Invalid regular expression flag");
    }
    if (flags.indexOf(flag, i2 + 1) > -1) {
      this.raise(state.start, "Duplicate regular expression flag");
    }
    if (flag === "u") {
      u = true;
    }
    if (flag === "v") {
      v = true;
    }
  }
  if (this.options.ecmaVersion >= 15 && u && v) {
    this.raise(state.start, "Invalid regular expression flag");
  }
};
function hasProp(obj) {
  for (var _ in obj) {
    return true;
  }
  return false;
}
pp$1.validateRegExpPattern = function(state) {
  this.regexp_pattern(state);
  if (!state.switchN && this.options.ecmaVersion >= 9 && hasProp(state.groupNames)) {
    state.switchN = true;
    this.regexp_pattern(state);
  }
};
pp$1.regexp_pattern = function(state) {
  state.pos = 0;
  state.lastIntValue = 0;
  state.lastStringValue = "";
  state.lastAssertionIsQuantifiable = false;
  state.numCapturingParens = 0;
  state.maxBackReference = 0;
  state.groupNames = /* @__PURE__ */ Object.create(null);
  state.backReferenceNames.length = 0;
  state.branchID = null;
  this.regexp_disjunction(state);
  if (state.pos !== state.source.length) {
    if (state.eat(
      41
      /* ) */
    )) {
      state.raise("Unmatched ')'");
    }
    if (state.eat(
      93
      /* ] */
    ) || state.eat(
      125
      /* } */
    )) {
      state.raise("Lone quantifier brackets");
    }
  }
  if (state.maxBackReference > state.numCapturingParens) {
    state.raise("Invalid escape");
  }
  for (var i2 = 0, list2 = state.backReferenceNames; i2 < list2.length; i2 += 1) {
    var name = list2[i2];
    if (!state.groupNames[name]) {
      state.raise("Invalid named capture referenced");
    }
  }
};
pp$1.regexp_disjunction = function(state) {
  var trackDisjunction = this.options.ecmaVersion >= 16;
  if (trackDisjunction) {
    state.branchID = new BranchID(state.branchID, null);
  }
  this.regexp_alternative(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (trackDisjunction) {
      state.branchID = state.branchID.sibling();
    }
    this.regexp_alternative(state);
  }
  if (trackDisjunction) {
    state.branchID = state.branchID.parent;
  }
  if (this.regexp_eatQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  if (state.eat(
    123
    /* { */
  )) {
    state.raise("Lone quantifier brackets");
  }
};
pp$1.regexp_alternative = function(state) {
  while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
  }
};
pp$1.regexp_eatTerm = function(state) {
  if (this.regexp_eatAssertion(state)) {
    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
      if (state.switchU) {
        state.raise("Invalid quantifier");
      }
    }
    return true;
  }
  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    this.regexp_eatQuantifier(state);
    return true;
  }
  return false;
};
pp$1.regexp_eatAssertion = function(state) {
  var start = state.pos;
  state.lastAssertionIsQuantifiable = false;
  if (state.eat(
    94
    /* ^ */
  ) || state.eat(
    36
    /* $ */
  )) {
    return true;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    if (state.eat(
      66
      /* B */
    ) || state.eat(
      98
      /* b */
    )) {
      return true;
    }
    state.pos = start;
  }
  if (state.eat(
    40
    /* ( */
  ) && state.eat(
    63
    /* ? */
  )) {
    var lookbehind = false;
    if (this.options.ecmaVersion >= 9) {
      lookbehind = state.eat(
        60
        /* < */
      );
    }
    if (state.eat(
      61
      /* = */
    ) || state.eat(
      33
      /* ! */
    )) {
      this.regexp_disjunction(state);
      if (!state.eat(
        41
        /* ) */
      )) {
        state.raise("Unterminated group");
      }
      state.lastAssertionIsQuantifiable = !lookbehind;
      return true;
    }
  }
  state.pos = start;
  return false;
};
pp$1.regexp_eatQuantifier = function(state, noError) {
  if (noError === void 0) noError = false;
  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    state.eat(
      63
      /* ? */
    );
    return true;
  }
  return false;
};
pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
  return state.eat(
    42
    /* * */
  ) || state.eat(
    43
    /* + */
  ) || state.eat(
    63
    /* ? */
  ) || this.regexp_eatBracedQuantifier(state, noError);
};
pp$1.regexp_eatBracedQuantifier = function(state, noError) {
  var start = state.pos;
  if (state.eat(
    123
    /* { */
  )) {
    var min = 0, max = -1;
    if (this.regexp_eatDecimalDigits(state)) {
      min = state.lastIntValue;
      if (state.eat(
        44
        /* , */
      ) && this.regexp_eatDecimalDigits(state)) {
        max = state.lastIntValue;
      }
      if (state.eat(
        125
        /* } */
      )) {
        if (max !== -1 && max < min && !noError) {
          state.raise("numbers out of order in {} quantifier");
        }
        return true;
      }
    }
    if (state.switchU && !noError) {
      state.raise("Incomplete quantifier");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatAtom = function(state) {
  return this.regexp_eatPatternCharacters(state) || state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
};
pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatAtomEscape(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatUncapturingGroup = function(state) {
  var start = state.pos;
  if (state.eat(
    40
    /* ( */
  )) {
    if (state.eat(
      63
      /* ? */
    )) {
      if (this.options.ecmaVersion >= 16) {
        var addModifiers = this.regexp_eatModifiers(state);
        var hasHyphen = state.eat(
          45
          /* - */
        );
        if (addModifiers || hasHyphen) {
          for (var i2 = 0; i2 < addModifiers.length; i2++) {
            var modifier = addModifiers.charAt(i2);
            if (addModifiers.indexOf(modifier, i2 + 1) > -1) {
              state.raise("Duplicate regular expression modifiers");
            }
          }
          if (hasHyphen) {
            var removeModifiers = this.regexp_eatModifiers(state);
            if (!addModifiers && !removeModifiers && state.current() === 58) {
              state.raise("Invalid regular expression modifiers");
            }
            for (var i$1 = 0; i$1 < removeModifiers.length; i$1++) {
              var modifier$1 = removeModifiers.charAt(i$1);
              if (removeModifiers.indexOf(modifier$1, i$1 + 1) > -1 || addModifiers.indexOf(modifier$1) > -1) {
                state.raise("Duplicate regular expression modifiers");
              }
            }
          }
        }
      }
      if (state.eat(
        58
        /* : */
      )) {
        this.regexp_disjunction(state);
        if (state.eat(
          41
          /* ) */
        )) {
          return true;
        }
        state.raise("Unterminated group");
      }
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatCapturingGroup = function(state) {
  if (state.eat(
    40
    /* ( */
  )) {
    if (this.options.ecmaVersion >= 9) {
      this.regexp_groupSpecifier(state);
    } else if (state.current() === 63) {
      state.raise("Invalid group");
    }
    this.regexp_disjunction(state);
    if (state.eat(
      41
      /* ) */
    )) {
      state.numCapturingParens += 1;
      return true;
    }
    state.raise("Unterminated group");
  }
  return false;
};
pp$1.regexp_eatModifiers = function(state) {
  var modifiers = "";
  var ch = 0;
  while ((ch = state.current()) !== -1 && isRegularExpressionModifier(ch)) {
    modifiers += codePointToString2(ch);
    state.advance();
  }
  return modifiers;
};
function isRegularExpressionModifier(ch) {
  return ch === 105 || ch === 109 || ch === 115;
}
pp$1.regexp_eatExtendedAtom = function(state) {
  return state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
};
pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
  if (this.regexp_eatBracedQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  return false;
};
pp$1.regexp_eatSyntaxCharacter = function(state) {
  var ch = state.current();
  if (isSyntaxCharacter(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
function isSyntaxCharacter(ch) {
  return ch === 36 || ch >= 40 && ch <= 43 || ch === 46 || ch === 63 || ch >= 91 && ch <= 94 || ch >= 123 && ch <= 125;
}
pp$1.regexp_eatPatternCharacters = function(state) {
  var start = state.pos;
  var ch = 0;
  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
    state.advance();
  }
  return state.pos !== start;
};
pp$1.regexp_eatExtendedPatternCharacter = function(state) {
  var ch = state.current();
  if (ch !== -1 && ch !== 36 && !(ch >= 40 && ch <= 43) && ch !== 46 && ch !== 63 && ch !== 91 && ch !== 94 && ch !== 124) {
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_groupSpecifier = function(state) {
  if (state.eat(
    63
    /* ? */
  )) {
    if (!this.regexp_eatGroupName(state)) {
      state.raise("Invalid group");
    }
    var trackDisjunction = this.options.ecmaVersion >= 16;
    var known = state.groupNames[state.lastStringValue];
    if (known) {
      if (trackDisjunction) {
        for (var i2 = 0, list2 = known; i2 < list2.length; i2 += 1) {
          var altID = list2[i2];
          if (!altID.separatedFrom(state.branchID)) {
            state.raise("Duplicate capture group name");
          }
        }
      } else {
        state.raise("Duplicate capture group name");
      }
    }
    if (trackDisjunction) {
      (known || (state.groupNames[state.lastStringValue] = [])).push(state.branchID);
    } else {
      state.groupNames[state.lastStringValue] = true;
    }
  }
};
pp$1.regexp_eatGroupName = function(state) {
  state.lastStringValue = "";
  if (state.eat(
    60
    /* < */
  )) {
    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(
      62
      /* > */
    )) {
      return true;
    }
    state.raise("Invalid capture group name");
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierName = function(state) {
  state.lastStringValue = "";
  if (this.regexp_eatRegExpIdentifierStart(state)) {
    state.lastStringValue += codePointToString2(state.lastIntValue);
    while (this.regexp_eatRegExpIdentifierPart(state)) {
      state.lastStringValue += codePointToString2(state.lastIntValue);
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierStart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierStart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierStart(ch) {
  return isIdentifierStart(ch, true) || ch === 36 || ch === 95;
}
pp$1.regexp_eatRegExpIdentifierPart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierPart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierPart(ch) {
  return isIdentifierChar(ch, true) || ch === 36 || ch === 95 || ch === 8204 || ch === 8205;
}
pp$1.regexp_eatAtomEscape = function(state) {
  if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
    return true;
  }
  if (state.switchU) {
    if (state.current() === 99) {
      state.raise("Invalid unicode escape");
    }
    state.raise("Invalid escape");
  }
  return false;
};
pp$1.regexp_eatBackReference = function(state) {
  var start = state.pos;
  if (this.regexp_eatDecimalEscape(state)) {
    var n = state.lastIntValue;
    if (state.switchU) {
      if (n > state.maxBackReference) {
        state.maxBackReference = n;
      }
      return true;
    }
    if (n <= state.numCapturingParens) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatKGroupName = function(state) {
  if (state.eat(
    107
    /* k */
  )) {
    if (this.regexp_eatGroupName(state)) {
      state.backReferenceNames.push(state.lastStringValue);
      return true;
    }
    state.raise("Invalid named reference");
  }
  return false;
};
pp$1.regexp_eatCharacterEscape = function(state) {
  return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
};
pp$1.regexp_eatCControlLetter = function(state) {
  var start = state.pos;
  if (state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatZero = function(state) {
  if (state.current() === 48 && !isDecimalDigit(state.lookahead())) {
    state.lastIntValue = 0;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlEscape = function(state) {
  var ch = state.current();
  if (ch === 116) {
    state.lastIntValue = 9;
    state.advance();
    return true;
  }
  if (ch === 110) {
    state.lastIntValue = 10;
    state.advance();
    return true;
  }
  if (ch === 118) {
    state.lastIntValue = 11;
    state.advance();
    return true;
  }
  if (ch === 102) {
    state.lastIntValue = 12;
    state.advance();
    return true;
  }
  if (ch === 114) {
    state.lastIntValue = 13;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlLetter = function(state) {
  var ch = state.current();
  if (isControlLetter(ch)) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
function isControlLetter(ch) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122;
}
pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
  if (forceU === void 0) forceU = false;
  var start = state.pos;
  var switchU = forceU || state.switchU;
  if (state.eat(
    117
    /* u */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 4)) {
      var lead = state.lastIntValue;
      if (switchU && lead >= 55296 && lead <= 56319) {
        var leadSurrogateEnd = state.pos;
        if (state.eat(
          92
          /* \ */
        ) && state.eat(
          117
          /* u */
        ) && this.regexp_eatFixedHexDigits(state, 4)) {
          var trail = state.lastIntValue;
          if (trail >= 56320 && trail <= 57343) {
            state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
            return true;
          }
        }
        state.pos = leadSurrogateEnd;
        state.lastIntValue = lead;
      }
      return true;
    }
    if (switchU && state.eat(
      123
      /* { */
    ) && this.regexp_eatHexDigits(state) && state.eat(
      125
      /* } */
    ) && isValidUnicode(state.lastIntValue)) {
      return true;
    }
    if (switchU) {
      state.raise("Invalid unicode escape");
    }
    state.pos = start;
  }
  return false;
};
function isValidUnicode(ch) {
  return ch >= 0 && ch <= 1114111;
}
pp$1.regexp_eatIdentityEscape = function(state) {
  if (state.switchU) {
    if (this.regexp_eatSyntaxCharacter(state)) {
      return true;
    }
    if (state.eat(
      47
      /* / */
    )) {
      state.lastIntValue = 47;
      return true;
    }
    return false;
  }
  var ch = state.current();
  if (ch !== 99 && (!state.switchN || ch !== 107)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatDecimalEscape = function(state) {
  state.lastIntValue = 0;
  var ch = state.current();
  if (ch >= 49 && ch <= 57) {
    do {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
      state.advance();
    } while ((ch = state.current()) >= 48 && ch <= 57);
    return true;
  }
  return false;
};
var CharSetNone = 0;
var CharSetOk = 1;
var CharSetString = 2;
pp$1.regexp_eatCharacterClassEscape = function(state) {
  var ch = state.current();
  if (isCharacterClassEscape(ch)) {
    state.lastIntValue = -1;
    state.advance();
    return CharSetOk;
  }
  var negate = false;
  if (state.switchU && this.options.ecmaVersion >= 9 && ((negate = ch === 80) || ch === 112)) {
    state.lastIntValue = -1;
    state.advance();
    var result;
    if (state.eat(
      123
      /* { */
    ) && (result = this.regexp_eatUnicodePropertyValueExpression(state)) && state.eat(
      125
      /* } */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Invalid property name");
      }
      return result;
    }
    state.raise("Invalid property name");
  }
  return CharSetNone;
};
function isCharacterClassEscape(ch) {
  return ch === 100 || ch === 68 || ch === 115 || ch === 83 || ch === 119 || ch === 87;
}
pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
  var start = state.pos;
  if (this.regexp_eatUnicodePropertyName(state) && state.eat(
    61
    /* = */
  )) {
    var name = state.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(state)) {
      var value = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
      return CharSetOk;
    }
  }
  state.pos = start;
  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    var nameOrValue = state.lastStringValue;
    return this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
  }
  return CharSetNone;
};
pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
  if (!hasOwn(state.unicodeProperties.nonBinary, name)) {
    state.raise("Invalid property name");
  }
  if (!state.unicodeProperties.nonBinary[name].test(value)) {
    state.raise("Invalid property value");
  }
};
pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
  if (state.unicodeProperties.binary.test(nameOrValue)) {
    return CharSetOk;
  }
  if (state.switchV && state.unicodeProperties.binaryOfStrings.test(nameOrValue)) {
    return CharSetString;
  }
  state.raise("Invalid property name");
};
pp$1.regexp_eatUnicodePropertyName = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyNameCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString2(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyNameCharacter(ch) {
  return isControlLetter(ch) || ch === 95;
}
pp$1.regexp_eatUnicodePropertyValue = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyValueCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString2(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyValueCharacter(ch) {
  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch);
}
pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
  return this.regexp_eatUnicodePropertyValue(state);
};
pp$1.regexp_eatCharacterClass = function(state) {
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (!state.eat(
      93
      /* ] */
    )) {
      state.raise("Unterminated character class");
    }
    if (negate && result === CharSetString) {
      state.raise("Negated character class may contain strings");
    }
    return true;
  }
  return false;
};
pp$1.regexp_classContents = function(state) {
  if (state.current() === 93) {
    return CharSetOk;
  }
  if (state.switchV) {
    return this.regexp_classSetExpression(state);
  }
  this.regexp_nonEmptyClassRanges(state);
  return CharSetOk;
};
pp$1.regexp_nonEmptyClassRanges = function(state) {
  while (this.regexp_eatClassAtom(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassAtom(state)) {
      var right = state.lastIntValue;
      if (state.switchU && (left === -1 || right === -1)) {
        state.raise("Invalid character class");
      }
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
    }
  }
};
pp$1.regexp_eatClassAtom = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatClassEscape(state)) {
      return true;
    }
    if (state.switchU) {
      var ch$1 = state.current();
      if (ch$1 === 99 || isOctalDigit(ch$1)) {
        state.raise("Invalid class escape");
      }
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  var ch = state.current();
  if (ch !== 93) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatClassEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    98
    /* b */
  )) {
    state.lastIntValue = 8;
    return true;
  }
  if (state.switchU && state.eat(
    45
    /* - */
  )) {
    state.lastIntValue = 45;
    return true;
  }
  if (!state.switchU && state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatClassControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
};
pp$1.regexp_classSetExpression = function(state) {
  var result = CharSetOk, subResult;
  if (this.regexp_eatClassSetRange(state)) ;
  else if (subResult = this.regexp_eatClassSetOperand(state)) {
    if (subResult === CharSetString) {
      result = CharSetString;
    }
    var start = state.pos;
    while (state.eatChars(
      [38, 38]
      /* && */
    )) {
      if (state.current() !== 38 && (subResult = this.regexp_eatClassSetOperand(state))) {
        if (subResult !== CharSetString) {
          result = CharSetOk;
        }
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
    while (state.eatChars(
      [45, 45]
      /* -- */
    )) {
      if (this.regexp_eatClassSetOperand(state)) {
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
  } else {
    state.raise("Invalid character in character class");
  }
  for (; ; ) {
    if (this.regexp_eatClassSetRange(state)) {
      continue;
    }
    subResult = this.regexp_eatClassSetOperand(state);
    if (!subResult) {
      return result;
    }
    if (subResult === CharSetString) {
      result = CharSetString;
    }
  }
};
pp$1.regexp_eatClassSetRange = function(state) {
  var start = state.pos;
  if (this.regexp_eatClassSetCharacter(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassSetCharacter(state)) {
      var right = state.lastIntValue;
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatClassSetOperand = function(state) {
  if (this.regexp_eatClassSetCharacter(state)) {
    return CharSetOk;
  }
  return this.regexp_eatClassStringDisjunction(state) || this.regexp_eatNestedClass(state);
};
pp$1.regexp_eatNestedClass = function(state) {
  var start = state.pos;
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (state.eat(
      93
      /* ] */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Negated character class may contain strings");
      }
      return result;
    }
    state.pos = start;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    var result$1 = this.regexp_eatCharacterClassEscape(state);
    if (result$1) {
      return result$1;
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_eatClassStringDisjunction = function(state) {
  var start = state.pos;
  if (state.eatChars(
    [92, 113]
    /* \q */
  )) {
    if (state.eat(
      123
      /* { */
    )) {
      var result = this.regexp_classStringDisjunctionContents(state);
      if (state.eat(
        125
        /* } */
      )) {
        return result;
      }
    } else {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_classStringDisjunctionContents = function(state) {
  var result = this.regexp_classString(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (this.regexp_classString(state) === CharSetString) {
      result = CharSetString;
    }
  }
  return result;
};
pp$1.regexp_classString = function(state) {
  var count = 0;
  while (this.regexp_eatClassSetCharacter(state)) {
    count++;
  }
  return count === 1 ? CharSetOk : CharSetString;
};
pp$1.regexp_eatClassSetCharacter = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatCharacterEscape(state) || this.regexp_eatClassSetReservedPunctuator(state)) {
      return true;
    }
    if (state.eat(
      98
      /* b */
    )) {
      state.lastIntValue = 8;
      return true;
    }
    state.pos = start;
    return false;
  }
  var ch = state.current();
  if (ch < 0 || ch === state.lookahead() && isClassSetReservedDoublePunctuatorCharacter(ch)) {
    return false;
  }
  if (isClassSetSyntaxCharacter(ch)) {
    return false;
  }
  state.advance();
  state.lastIntValue = ch;
  return true;
};
function isClassSetReservedDoublePunctuatorCharacter(ch) {
  return ch === 33 || ch >= 35 && ch <= 38 || ch >= 42 && ch <= 44 || ch === 46 || ch >= 58 && ch <= 64 || ch === 94 || ch === 96 || ch === 126;
}
function isClassSetSyntaxCharacter(ch) {
  return ch === 40 || ch === 41 || ch === 45 || ch === 47 || ch >= 91 && ch <= 93 || ch >= 123 && ch <= 125;
}
pp$1.regexp_eatClassSetReservedPunctuator = function(state) {
  var ch = state.current();
  if (isClassSetReservedPunctuator(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
function isClassSetReservedPunctuator(ch) {
  return ch === 33 || ch === 35 || ch === 37 || ch === 38 || ch === 44 || ch === 45 || ch >= 58 && ch <= 62 || ch === 64 || ch === 96 || ch === 126;
}
pp$1.regexp_eatClassControlLetter = function(state) {
  var ch = state.current();
  if (isDecimalDigit(ch) || ch === 95) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatHexEscapeSequence = function(state) {
  var start = state.pos;
  if (state.eat(
    120
    /* x */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 2)) {
      return true;
    }
    if (state.switchU) {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatDecimalDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isDecimalDigit(ch = state.current())) {
    state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
    state.advance();
  }
  return state.pos !== start;
};
function isDecimalDigit(ch) {
  return ch >= 48 && ch <= 57;
}
pp$1.regexp_eatHexDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isHexDigit(ch = state.current())) {
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return state.pos !== start;
};
function isHexDigit(ch) {
  return ch >= 48 && ch <= 57 || ch >= 65 && ch <= 70 || ch >= 97 && ch <= 102;
}
function hexToInt(ch) {
  if (ch >= 65 && ch <= 70) {
    return 10 + (ch - 65);
  }
  if (ch >= 97 && ch <= 102) {
    return 10 + (ch - 97);
  }
  return ch - 48;
}
pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
  if (this.regexp_eatOctalDigit(state)) {
    var n1 = state.lastIntValue;
    if (this.regexp_eatOctalDigit(state)) {
      var n2 = state.lastIntValue;
      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
      } else {
        state.lastIntValue = n1 * 8 + n2;
      }
    } else {
      state.lastIntValue = n1;
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatOctalDigit = function(state) {
  var ch = state.current();
  if (isOctalDigit(ch)) {
    state.lastIntValue = ch - 48;
    state.advance();
    return true;
  }
  state.lastIntValue = 0;
  return false;
};
function isOctalDigit(ch) {
  return ch >= 48 && ch <= 55;
}
pp$1.regexp_eatFixedHexDigits = function(state, length) {
  var start = state.pos;
  state.lastIntValue = 0;
  for (var i2 = 0; i2 < length; ++i2) {
    var ch = state.current();
    if (!isHexDigit(ch)) {
      state.pos = start;
      return false;
    }
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return true;
};
var Token = function Token2(p) {
  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations) {
    this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
  }
  if (p.options.ranges) {
    this.range = [p.start, p.end];
  }
};
var pp = Parser2.prototype;
pp.next = function(ignoreEscapeSequenceInKeyword) {
  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
  }
  if (this.options.onToken) {
    this.options.onToken(new Token(this));
  }
  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};
pp.getToken = function() {
  this.next();
  return new Token(this);
};
if (typeof Symbol !== "undefined") {
  pp[Symbol.iterator] = function() {
    var this$1$1 = this;
    return {
      next: function() {
        var token = this$1$1.getToken();
        return {
          done: token.type === types$1.eof,
          value: token
        };
      }
    };
  };
}
pp.nextToken = function() {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) {
    this.skipSpace();
  }
  this.start = this.pos;
  if (this.options.locations) {
    this.startLoc = this.curPosition();
  }
  if (this.pos >= this.input.length) {
    return this.finishToken(types$1.eof);
  }
  if (curContext.override) {
    return curContext.override(this);
  } else {
    this.readToken(this.fullCharCodeAtPos());
  }
};
pp.readToken = function(code) {
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92) {
    return this.readWord();
  }
  return this.getTokenFromCode(code);
};
pp.fullCharCodeAt = function(pos) {
  var code = this.input.charCodeAt(pos);
  if (code <= 55295 || code >= 56320) {
    return code;
  }
  var next = this.input.charCodeAt(pos + 1);
  return next <= 56319 || next >= 57344 ? code : (code << 10) + next - 56613888;
};
pp.fullCharCodeAtPos = function() {
  return this.fullCharCodeAt(this.pos);
};
pp.skipBlockComment = function() {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) {
    this.raise(this.pos - 2, "Unterminated comment");
  }
  this.pos = end + 2;
  if (this.options.locations) {
    for (var nextBreak = void 0, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1; ) {
      ++this.curLine;
      pos = this.lineStart = nextBreak;
    }
  }
  if (this.options.onComment) {
    this.options.onComment(
      true,
      this.input.slice(start + 2, end),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp.skipLineComment = function(startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && !isNewLine(ch)) {
    ch = this.input.charCodeAt(++this.pos);
  }
  if (this.options.onComment) {
    this.options.onComment(
      false,
      this.input.slice(start + startSkip, this.pos),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp.skipSpace = function() {
  loop: while (this.pos < this.input.length) {
    var ch = this.input.charCodeAt(this.pos);
    switch (ch) {
      case 32:
      case 160:
        ++this.pos;
        break;
      case 13:
        if (this.input.charCodeAt(this.pos + 1) === 10) {
          ++this.pos;
        }
      case 10:
      case 8232:
      case 8233:
        ++this.pos;
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        break;
      case 47:
        switch (this.input.charCodeAt(this.pos + 1)) {
          case 42:
            this.skipBlockComment();
            break;
          case 47:
            this.skipLineComment(2);
            break;
          default:
            break loop;
        }
        break;
      default:
        if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
          ++this.pos;
        } else {
          break loop;
        }
    }
  }
};
pp.finishToken = function(type, val) {
  this.end = this.pos;
  if (this.options.locations) {
    this.endLoc = this.curPosition();
  }
  var prevType = this.type;
  this.type = type;
  this.value = val;
  this.updateContext(prevType);
};
pp.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) {
    return this.readNumber(true);
  }
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
    this.pos += 3;
    return this.finishToken(types$1.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(types$1.dot);
  }
};
pp.readToken_slash = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;
    return this.readRegexp();
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.slash, 1);
};
pp.readToken_mult_modulo_exp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  var tokentype = code === 42 ? types$1.star : types$1.modulo;
  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
    ++size;
    tokentype = types$1.starstar;
    next = this.input.charCodeAt(this.pos + 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, size + 1);
  }
  return this.finishOp(tokentype, size);
};
pp.readToken_pipe_amp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (this.options.ecmaVersion >= 12) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 === 61) {
        return this.finishOp(types$1.assign, 3);
      }
    }
    return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1);
};
pp.readToken_caret = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.bitwiseXOR, 1);
};
pp.readToken_plus_min = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak2.test(this.input.slice(this.lastTokEnd, this.pos)))) {
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(types$1.incDec, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.plusMin, 1);
};
pp.readToken_lt_gt = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) {
      return this.finishOp(types$1.assign, size + 1);
    }
    return this.finishOp(types$1.bitShift, size);
  }
  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) {
    size = 2;
  }
  return this.finishOp(types$1.relational, size);
};
pp.readToken_eq_excl = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  }
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    this.pos += 2;
    return this.finishToken(types$1.arrow);
  }
  return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1);
};
pp.readToken_question = function() {
  var ecmaVersion2 = this.options.ecmaVersion;
  if (ecmaVersion2 >= 11) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 46) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 < 48 || next2 > 57) {
        return this.finishOp(types$1.questionDot, 2);
      }
    }
    if (next === 63) {
      if (ecmaVersion2 >= 12) {
        var next2$1 = this.input.charCodeAt(this.pos + 2);
        if (next2$1 === 61) {
          return this.finishOp(types$1.assign, 3);
        }
      }
      return this.finishOp(types$1.coalesce, 2);
    }
  }
  return this.finishOp(types$1.question, 1);
};
pp.readToken_numberSign = function() {
  var ecmaVersion2 = this.options.ecmaVersion;
  var code = 35;
  if (ecmaVersion2 >= 13) {
    ++this.pos;
    code = this.fullCharCodeAtPos();
    if (isIdentifierStart(code, true) || code === 92) {
      return this.finishToken(types$1.privateId, this.readWord1());
    }
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString2(code) + "'");
};
pp.getTokenFromCode = function(code) {
  switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46:
      return this.readToken_dot();
    // Punctuation tokens.
    case 40:
      ++this.pos;
      return this.finishToken(types$1.parenL);
    case 41:
      ++this.pos;
      return this.finishToken(types$1.parenR);
    case 59:
      ++this.pos;
      return this.finishToken(types$1.semi);
    case 44:
      ++this.pos;
      return this.finishToken(types$1.comma);
    case 91:
      ++this.pos;
      return this.finishToken(types$1.bracketL);
    case 93:
      ++this.pos;
      return this.finishToken(types$1.bracketR);
    case 123:
      ++this.pos;
      return this.finishToken(types$1.braceL);
    case 125:
      ++this.pos;
      return this.finishToken(types$1.braceR);
    case 58:
      ++this.pos;
      return this.finishToken(types$1.colon);
    case 96:
      if (this.options.ecmaVersion < 6) {
        break;
      }
      ++this.pos;
      return this.finishToken(types$1.backQuote);
    case 48:
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) {
        return this.readRadixNumber(16);
      }
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) {
          return this.readRadixNumber(8);
        }
        if (next === 98 || next === 66) {
          return this.readRadixNumber(2);
        }
      }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return this.readNumber(false);
    // Quotes produce strings.
    case 34:
    case 39:
      return this.readString(code);
    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.
    case 47:
      return this.readToken_slash();
    case 37:
    case 42:
      return this.readToken_mult_modulo_exp(code);
    case 124:
    case 38:
      return this.readToken_pipe_amp(code);
    case 94:
      return this.readToken_caret();
    case 43:
    case 45:
      return this.readToken_plus_min(code);
    case 60:
    case 62:
      return this.readToken_lt_gt(code);
    case 61:
    case 33:
      return this.readToken_eq_excl(code);
    case 63:
      return this.readToken_question();
    case 126:
      return this.finishOp(types$1.prefix, 1);
    case 35:
      return this.readToken_numberSign();
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString2(code) + "'");
};
pp.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};
pp.readRegexp = function() {
  var escaped, inClass, start = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(start, "Unterminated regular expression");
    }
    var ch = this.input.charAt(this.pos);
    if (lineBreak2.test(ch)) {
      this.raise(start, "Unterminated regular expression");
    }
    if (!escaped) {
      if (ch === "[") {
        inClass = true;
      } else if (ch === "]" && inClass) {
        inClass = false;
      } else if (ch === "/" && !inClass) {
        break;
      }
      escaped = ch === "\\";
    } else {
      escaped = false;
    }
    ++this.pos;
  }
  var pattern = this.input.slice(start, this.pos);
  ++this.pos;
  var flagsStart = this.pos;
  var flags = this.readWord1();
  if (this.containsEsc) {
    this.unexpected(flagsStart);
  }
  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
  state.reset(start, pattern, flags);
  this.validateRegExpFlags(state);
  this.validateRegExpPattern(state);
  var value = null;
  try {
    value = new RegExp(pattern, flags);
  } catch (e) {
  }
  return this.finishToken(types$1.regexp, { pattern, flags, value });
};
pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
  var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
  var start = this.pos, total = 0, lastCode = 0;
  for (var i2 = 0, e = len == null ? Infinity : len; i2 < e; ++i2, ++this.pos) {
    var code = this.input.charCodeAt(this.pos), val = void 0;
    if (allowSeparators && code === 95) {
      if (isLegacyOctalNumericLiteral) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
      }
      if (lastCode === 95) {
        this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
      }
      if (i2 === 0) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
      }
      lastCode = code;
      continue;
    }
    if (code >= 97) {
      val = code - 97 + 10;
    } else if (code >= 65) {
      val = code - 65 + 10;
    } else if (code >= 48 && code <= 57) {
      val = code - 48;
    } else {
      val = Infinity;
    }
    if (val >= radix) {
      break;
    }
    lastCode = code;
    total = total * radix + val;
  }
  if (allowSeparators && lastCode === 95) {
    this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
  }
  if (this.pos === start || len != null && this.pos - start !== len) {
    return null;
  }
  return total;
};
function stringToNumber(str, isLegacyOctalNumericLiteral) {
  if (isLegacyOctalNumericLiteral) {
    return parseInt(str, 8);
  }
  return parseFloat(str.replace(/_/g, ""));
}
function stringToBigInt(str) {
  if (typeof BigInt !== "function") {
    return null;
  }
  return BigInt(str.replace(/_/g, ""));
}
pp.readRadixNumber = function(radix) {
  var start = this.pos;
  this.pos += 2;
  var val = this.readInt(radix);
  if (val == null) {
    this.raise(this.start + 2, "Expected number in radix " + radix);
  }
  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    val = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
  } else if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  return this.finishToken(types$1.num, val);
};
pp.readNumber = function(startsWithDot) {
  var start = this.pos;
  if (!startsWithDot && this.readInt(10, void 0, true) === null) {
    this.raise(start, "Invalid number");
  }
  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
  if (octal && this.strict) {
    this.raise(start, "Invalid number");
  }
  var next = this.input.charCodeAt(this.pos);
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
    if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    return this.finishToken(types$1.num, val$1);
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
    octal = false;
  }
  if (next === 46 && !octal) {
    ++this.pos;
    this.readInt(10);
    next = this.input.charCodeAt(this.pos);
  }
  if ((next === 69 || next === 101) && !octal) {
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) {
      ++this.pos;
    }
    if (this.readInt(10) === null) {
      this.raise(start, "Invalid number");
    }
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  var val = stringToNumber(this.input.slice(start, this.pos), octal);
  return this.finishToken(types$1.num, val);
};
pp.readCodePoint = function() {
  var ch = this.input.charCodeAt(this.pos), code;
  if (ch === 123) {
    if (this.options.ecmaVersion < 6) {
      this.unexpected();
    }
    var codePos = ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 1114111) {
      this.invalidStringToken(codePos, "Code point out of bounds");
    }
  } else {
    code = this.readHexChar(4);
  }
  return code;
};
pp.readString = function(quote) {
  var out2 = "", chunkStart = ++this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated string constant");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === quote) {
      break;
    }
    if (ch === 92) {
      out2 += this.input.slice(chunkStart, this.pos);
      out2 += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else if (ch === 8232 || ch === 8233) {
      if (this.options.ecmaVersion < 10) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
      if (this.options.locations) {
        this.curLine++;
        this.lineStart = this.pos;
      }
    } else {
      if (isNewLine(ch)) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
    }
  }
  out2 += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(types$1.string, out2);
};
var INVALID_TEMPLATE_ESCAPE_ERROR = {};
pp.tryReadTemplateToken = function() {
  this.inTemplateElement = true;
  try {
    this.readTmplToken();
  } catch (err) {
    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
      this.readInvalidTemplateToken();
    } else {
      throw err;
    }
  }
  this.inTemplateElement = false;
};
pp.invalidStringToken = function(position, message) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    throw INVALID_TEMPLATE_ESCAPE_ERROR;
  } else {
    this.raise(position, message);
  }
};
pp.readTmplToken = function() {
  var out2 = "", chunkStart = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated template");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
      if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(types$1.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(types$1.backQuote);
        }
      }
      out2 += this.input.slice(chunkStart, this.pos);
      return this.finishToken(types$1.template, out2);
    }
    if (ch === 92) {
      out2 += this.input.slice(chunkStart, this.pos);
      out2 += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (isNewLine(ch)) {
      out2 += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) {
            ++this.pos;
          }
        case 10:
          out2 += "\n";
          break;
        default:
          out2 += String.fromCharCode(ch);
          break;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};
pp.readInvalidTemplateToken = function() {
  for (; this.pos < this.input.length; this.pos++) {
    switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break;
      case "$":
        if (this.input[this.pos + 1] !== "{") {
          break;
        }
      // fall through
      case "`":
        return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos));
      case "\r":
        if (this.input[this.pos + 1] === "\n") {
          ++this.pos;
        }
      // fall through
      case "\n":
      case "\u2028":
      case "\u2029":
        ++this.curLine;
        this.lineStart = this.pos + 1;
        break;
    }
  }
  this.raise(this.start, "Unterminated template");
};
pp.readEscapedChar = function(inTemplate) {
  var ch = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch) {
    case 110:
      return "\n";
    // 'n' -> '\n'
    case 114:
      return "\r";
    // 'r' -> '\r'
    case 120:
      return String.fromCharCode(this.readHexChar(2));
    // 'x'
    case 117:
      return codePointToString2(this.readCodePoint());
    // 'u'
    case 116:
      return "	";
    // 't' -> '\t'
    case 98:
      return "\b";
    // 'b' -> '\b'
    case 118:
      return "\v";
    // 'v' -> '\u000b'
    case 102:
      return "\f";
    // 'f' -> '\f'
    case 13:
      if (this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
      }
    // '\r\n'
    case 10:
      if (this.options.locations) {
        this.lineStart = this.pos;
        ++this.curLine;
      }
      return "";
    case 56:
    case 57:
      if (this.strict) {
        this.invalidStringToken(
          this.pos - 1,
          "Invalid escape sequence"
        );
      }
      if (inTemplate) {
        var codePos = this.pos - 1;
        this.invalidStringToken(
          codePos,
          "Invalid escape sequence in template string"
        );
      }
    default:
      if (ch >= 48 && ch <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        this.pos += octalStr.length - 1;
        ch = this.input.charCodeAt(this.pos);
        if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
          this.invalidStringToken(
            this.pos - 1 - octalStr.length,
            inTemplate ? "Octal literal in template string" : "Octal literal in strict mode"
          );
        }
        return String.fromCharCode(octal);
      }
      if (isNewLine(ch)) {
        if (this.options.locations) {
          this.lineStart = this.pos;
          ++this.curLine;
        }
        return "";
      }
      return String.fromCharCode(ch);
  }
};
pp.readHexChar = function(len) {
  var codePos = this.pos;
  var n = this.readInt(16, len);
  if (n === null) {
    this.invalidStringToken(codePos, "Bad character escape sequence");
  }
  return n;
};
pp.readWord1 = function() {
  this.containsEsc = false;
  var word = "", first = true, chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch, astral)) {
      this.pos += ch <= 65535 ? 1 : 2;
    } else if (ch === 92) {
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) !== 117) {
        this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      }
      ++this.pos;
      var esc2 = this.readCodePoint();
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc2, astral)) {
        this.invalidStringToken(escStart, "Invalid Unicode escape");
      }
      word += codePointToString2(esc2);
      chunkStart = this.pos;
    } else {
      break;
    }
    first = false;
  }
  return word + this.input.slice(chunkStart, this.pos);
};
pp.readWord = function() {
  var word = this.readWord1();
  var type = types$1.name;
  if (this.keywords.test(word)) {
    type = keywords[word];
  }
  return this.finishToken(type, word);
};
var version = "8.19.0";
Parser2.acorn = {
  Parser: Parser2,
  version,
  defaultOptions,
  Position,
  SourceLocation,
  getLineInfo,
  Node,
  TokenType: TokenType2,
  tokTypes: types$1,
  keywordTypes: keywords,
  TokContext,
  tokContexts: types,
  isIdentifierChar,
  isIdentifierStart,
  Token,
  isNewLine,
  lineBreak: lineBreak2,
  lineBreakG,
  nonASCIIwhitespace
};
function parse4(input, options) {
  return Parser2.parse(input, options);
}

// src/engine/tokens.ts
function isTailwindConfigTarget(n) {
  const m = n;
  if (m.type !== "MemberExpression" || m.property?.type !== "Identifier" || m.property.name !== "config" || !m.object) return false;
  const o = m.object;
  return o.type === "Identifier" && o.name === "tailwind" || o.type === "MemberExpression" && o.property?.name === "tailwind";
}
function locateConfig(doc) {
  for (const n of doc.nodes) {
    if (n.tag !== "script" || !n.patchable || n.endTagStart === null || findAttr(n, "src")) continue;
    const code = doc.text.slice(n.startTagEnd, n.endTagStart);
    if (!code.includes("tailwind")) continue;
    let program;
    try {
      program = parse4(code, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true });
    } catch {
      continue;
    }
    for (const st of program.body) {
      if (st.type !== "ExpressionStatement") continue;
      const e = st.expression;
      if (e.type === "AssignmentExpression" && e.operator === "=" && isTailwindConfigTarget(e.left) && e.right.type === "ObjectExpression") {
        return { object: e.right, offset: n.startTagEnd };
      }
    }
  }
  return null;
}
function keyName(p) {
  if (p.type !== "Property" || p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal" && (typeof p.key.value === "string" || typeof p.key.value === "number")) return String(p.key.value);
  return null;
}
function findProp(o, name) {
  for (const p of o.properties) if (keyName(p) === name) return p;
  return null;
}
function evaluate(e) {
  switch (e.type) {
    case "Literal":
      return e.value instanceof RegExp ? void 0 : e.value;
    case "TemplateLiteral":
      return e.expressions.length === 0 ? e.quasis.map((q) => q.value.cooked).join("") : void 0;
    case "ArrayExpression":
      return e.elements.map((x) => x && x.type !== "SpreadElement" ? evaluate(x) : void 0);
    case "ObjectExpression": {
      const out2 = {};
      for (const p of e.properties) {
        const k = keyName(p);
        if (k !== null) out2[k] = evaluate(p.value);
      }
      return out2;
    }
    case "UnaryExpression":
      if (e.operator === "-" && e.argument.type === "Literal" && typeof e.argument.value === "number") return -e.argument.value;
      return void 0;
    default:
      return void 0;
  }
}
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function flattenColors(o, prefix = "", out2 = /* @__PURE__ */ new Map()) {
  if (!isObj(o)) return out2;
  for (const [k, v] of Object.entries(o)) {
    const name = k === "DEFAULT" ? prefix : prefix ? `${prefix}-${k}` : k;
    if (isObj(v)) flattenColors(v, name, out2);
    else if (name) out2.set(name, v);
  }
  return out2;
}
function readTokens(doc) {
  const loc = locateConfig(doc);
  if (!loc) return { ctx: { colors: /* @__PURE__ */ new Set(), fontSizes: /* @__PURE__ */ new Set(), fontFamilies: /* @__PURE__ */ new Set() }, configRange: null, values: {} };
  const values = evaluate(loc.object) ?? {};
  const theme = isObj(values.theme) ? values.theme : {};
  const extend2 = isObj(theme.extend) ? theme.extend : {};
  const keys = (field) => [
    ...isObj(theme[field]) ? Object.keys(theme[field]) : [],
    ...isObj(extend2[field]) ? Object.keys(extend2[field]) : []
  ];
  const colors = /* @__PURE__ */ new Set([...flattenColors(theme.colors).keys(), ...flattenColors(extend2.colors).keys()]);
  return {
    ctx: { colors, fontSizes: new Set(keys("fontSize")), fontFamilies: new Set(keys("fontFamily")) },
    configRange: { start: loc.offset + loc.object.start, end: loc.offset + loc.object.end },
    values
  };
}
var IDENT = /^[A-Za-z_$][\w$]*$/;
var keyText = (k) => IDENT.test(k) ? k : `'${k.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
function stringLiteral(value, quote) {
  const esc2 = value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return quote + (quote === '"' ? esc2.replace(/"/g, '\\"') : esc2.replace(/'/g, "\\'")) + quote;
}
function quoteStyle(text, o, offset2) {
  for (const p of o.properties) {
    if (p.type !== "Property") continue;
    if (p.value.type === "Literal" && typeof p.value.value === "string") return text[offset2 + p.value.start];
    if (p.value.type === "ObjectExpression") {
      const q = quoteStyle(text, p.value, offset2);
      if (q) return q;
    }
  }
  return "'";
}
function propIndent(text, o, offset2) {
  const props = o.properties;
  if (props.length) return lineIndent(text, offset2 + props[props.length - 1].start);
  const open = lineIndentOfLine(text, offset2 + o.start);
  return open === null ? null : open + "  ";
}
function lineIndentOfLine(text, at2) {
  let i2 = at2;
  while (i2 > 0 && text[i2 - 1] !== "\n") i2--;
  return /^[ \t]*/.exec(text.slice(i2, at2))[0];
}
function nestedLiteral(keys, value, quote) {
  if (keys.length === 1) return `${keyText(keys[0])}: ${stringLiteral(value, quote)}`;
  return `${keyText(keys[0])}: { ${nestedLiteral(keys.slice(1), value, quote)} }`;
}
function addProp(text, o, offset2, literal2) {
  const props = o.properties;
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const indent = propIndent(text, o, offset2);
  if (props.length === 0) {
    const inner = { start: offset2 + o.start + 1, end: offset2 + o.end - 1 };
    if (indent === null || !/[\r\n]/.test(text.slice(inner.start, inner.end))) {
      return { start: inner.start, end: inner.end, text: ` ${literal2} ` };
    }
    return { start: inner.start, end: inner.start, text: `${nl}${indent}${literal2},` };
  }
  const last = props[props.length - 1];
  const after = offset2 + last.end;
  const m = /^\s*,/.exec(text.slice(after, offset2 + o.end));
  if (indent === null) {
    return m ? { start: after + m[0].length, end: after + m[0].length, text: ` ${literal2},` } : { start: after, end: after, text: `, ${literal2}` };
  }
  if (m) return { start: after + m[0].length, end: after + m[0].length, text: `${nl}${indent}${literal2},` };
  return { start: after, end: after, text: `,${nl}${indent}${literal2}` };
}
function removeProp(text, o, p, offset2) {
  const s = offset2 + p.start;
  const e = offset2 + p.end;
  const tail = /^[ \t]*,/.exec(text.slice(e));
  const alone = lineIndent(text, s) !== null;
  if (tail) {
    let end = e + tail[0].length;
    const rest = /^[ \t]*(\r?\n)/.exec(text.slice(end));
    if (alone && rest) return { start: s - lineIndent(text, s).length, end: end + rest[0].length, text: "" };
    const sp = /^[ \t]*/.exec(text.slice(end))[0].length;
    end += sp;
    return { start: s, end, text: "" };
  }
  const idx = o.properties.indexOf(p);
  if (idx > 0) {
    const before = text.slice(offset2 + o.properties[idx - 1].end, s);
    const m = /,\s*$/.exec(before);
    if (m) return { start: s - m[0].length, end: e, text: "" };
  }
  return { start: s, end: e, text: "" };
}
function setTokenSplices(doc, path, value) {
  if (path.length === 0 || path.some((k) => typeof k !== "string" || k === "")) throw new OpError("invalid", "token path must be non-empty strings");
  const loc = locateConfig(doc);
  if (!loc) throw new OpError("unsupported", "this deck has no `tailwind.config = {...}` object literal in an inline script");
  const text = doc.text;
  const full = ["theme", "extend", ...path];
  let o = loc.object;
  const quote = quoteStyle(text, loc.object, loc.offset);
  for (let i2 = 0; i2 < full.length; i2++) {
    const p = findProp(o, full[i2]);
    const last = i2 === full.length - 1;
    if (!p) {
      if (value === null) return [];
      return [addProp(text, o, loc.offset, nestedLiteral(full.slice(i2), value, quote))];
    }
    if (last) {
      if (value === null) return [removeProp(text, o, p, loc.offset)];
      const v = p.value;
      if (v.type === "Literal" && typeof v.value === "string") {
        if (v.value === value) return [];
        return [{ start: loc.offset + v.start, end: loc.offset + v.end, text: stringLiteral(value, text[loc.offset + v.start]) }];
      }
      if (v.type === "ObjectExpression") throw new OpError("invalid", `token ${path.join(".")} is an object; set one of its keys instead`);
      return [{ start: loc.offset + v.start, end: loc.offset + v.end, text: stringLiteral(value, quote) }];
    }
    if (p.value.type !== "ObjectExpression") throw new OpError("unsupported", `${full.slice(0, i2 + 1).join(".")} is not an object literal`);
    o = p.value;
  }
  return [];
}

// src/engine/ops.ts
var OP_KINDS = [
  "setText",
  "setAttr",
  "setUtility",
  "setClasses",
  "setStyle",
  "insertHtml",
  "remove",
  "move",
  "duplicate",
  "wrap",
  "setToken"
];
function declarations(v) {
  const out2 = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const flush = (end, withSemi) => {
    const piece = v.slice(start, end);
    const colon = piece.indexOf(":");
    if (colon > 0) {
      const prop = piece.slice(0, colon).trim();
      let vs = start + colon + 1;
      while (vs < end && /\s/.test(v[vs])) vs++;
      let ve = end;
      while (ve > vs && /\s/.test(v[ve - 1])) ve--;
      out2.push({ start, end: end + withSemi, prop, vStart: vs, vEnd: ve });
    }
    start = end + withSemi;
  };
  for (let i2 = 0; i2 < v.length; i2++) {
    const c = v[i2];
    if (quote) {
      if (c === quote && v[i2 - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && depth > 0) depth--;
    else if (c === ";" && depth === 0) flush(i2, 1);
  }
  if (start < v.length) flush(v.length, 0);
  return out2;
}
var sameProp = (a, b) => a.startsWith("--") || b.startsWith("--") ? a === b : a.toLowerCase() === b.toLowerCase();
function setStyleSplices(doc, id, prop, value) {
  const n = requirePatchable(doc, id);
  if (!/^(--[\w-]+|-?[A-Za-z][\w-]*)$/.test(prop)) throw new OpError("invalid", `invalid CSS property name ${JSON.stringify(prop)}`);
  if (value !== null && (/[\r\n]/.test(value) || value.trim() === "")) throw new OpError("invalid", `invalid CSS value ${JSON.stringify(value)}`);
  const a = findAttr(n, "style");
  if (!a) return value === null ? [] : setAttrSplices(doc, n, "style", `${prop}: ${value.trim()}`);
  const v = a.value;
  const decls = declarations(v);
  const found = [...decls].reverse().find((d) => sameProp(d.prop, prop));
  let s;
  let e;
  let t;
  if (found) {
    if (value === null) {
      s = found.start;
      e = found.end;
      while (s > 0 && /\s/.test(v[s - 1])) s--;
      if (s === 0) while (e < v.length && /\s/.test(v[e])) e++;
      t = "";
    } else {
      s = found.vStart;
      e = found.vEnd;
      t = value.trim();
    }
  } else {
    if (value === null) return [];
    let end = v.length;
    while (end > 0 && /\s/.test(v[end - 1])) end--;
    s = e = end;
    t = end === 0 ? `${prop}: ${value.trim()}` : v[end - 1] === ";" ? ` ${prop}: ${value.trim()};` : `; ${prop}: ${value.trim()}`;
  }
  const next = v.slice(0, s) + t + v.slice(e);
  if (next.trim() === "") return setAttrSplices(doc, n, "style", null);
  const range = attrValueRange(doc.text, a);
  if (!range || !rawEqualsDecoded(doc.text, a) || a.quote === "" && !UNQUOTED_SAFE.test(next)) {
    return setAttrSplices(doc, n, "style", next);
  }
  return [{ start: range.vStart + s, end: range.vStart + e, text: a.quote ? escapeAttr(t, a.quote) : t }];
}
var isId = (x) => Number.isInteger(x) && x >= 0;
var isStr = (x) => typeof x === "string";
var isStrOrNull = (x) => x === null || typeof x === "string";
function validateOp(op) {
  const o = op;
  const bad = (field) => {
    throw new OpError("invalid", `op ${JSON.stringify(o?.kind)}: invalid or missing field '${field}'`);
  };
  if (typeof o !== "object" || o === null) throw new OpError("invalid", "op must be an object");
  switch (o.kind) {
    case "setText":
      if (!isId(o.id)) bad("id");
      if (!isStr(o.text)) bad("text");
      return;
    case "setAttr":
      if (!isId(o.id)) bad("id");
      if (!isStr(o.name) || o.name === "") bad("name");
      if (!isStrOrNull(o.value)) bad("value");
      return;
    case "setUtility":
      if (!isId(o.id)) bad("id");
      if (!GROUPS.includes(o.group)) bad("group");
      if (!isStrOrNull(o.value)) bad("value");
      return;
    case "setClasses":
      if (!isId(o.id)) bad("id");
      if (!Array.isArray(o.classes) || !o.classes.every(isStr)) bad("classes");
      return;
    case "setStyle":
      if (!isId(o.id)) bad("id");
      if (!isStr(o.prop)) bad("prop");
      if (!isStrOrNull(o.value)) bad("value");
      return;
    case "insertHtml":
      if (!isId(o.parent)) bad("parent");
      if (!Number.isInteger(o.index)) bad("index");
      if (!isStr(o.html)) bad("html");
      return;
    case "remove":
    case "duplicate":
      if (!isId(o.id)) bad("id");
      return;
    case "move":
      if (!isId(o.id)) bad("id");
      if (!isId(o.parent)) bad("parent");
      if (!Number.isInteger(o.index)) bad("index");
      return;
    case "wrap":
      if (!Array.isArray(o.ids) || !o.ids.every(isId)) bad("ids");
      if (!isStr(o.html)) bad("html");
      return;
    case "setToken":
      if (!Array.isArray(o.path) || !o.path.every(isStr)) bad("path");
      if (!isStrOrNull(o.value)) bad("value");
      return;
    default:
      throw new OpError("invalid", `unknown op kind ${JSON.stringify(o.kind)}; expected one of ${OP_KINDS.join(", ")}`);
  }
}
function minimal(text, splices) {
  if (splices.length !== 1) return splices;
  const s = splices[0];
  const old = text.slice(s.start, s.end);
  if (old === s.text) return [];
  let p = 0;
  while (p < old.length && p < s.text.length && old[p] === s.text[p]) p++;
  let q = 0;
  while (q < old.length - p && q < s.text.length - p && old[old.length - 1 - q] === s.text[s.text.length - 1 - q]) q++;
  if (p === 0 && q === 0) return splices;
  return [{ start: s.start + p, end: s.end - q, text: s.text.slice(p, s.text.length - q) }];
}
function resolveOp(doc, op, ctx) {
  validateOp(op);
  return minimal(doc.text, resolveRaw(doc, op, ctx));
}
function resolveRaw(doc, op, ctx) {
  switch (op.kind) {
    case "setText":
      return setText(doc, op.id, op.text);
    case "setAttr":
      return setAttrSplices(doc, requirePatchable(doc, op.id), op.name, op.value);
    case "setUtility": {
      const n = requirePatchable(doc, op.id);
      return setClassAttr(doc, op.id, setUtility(classList(n), op.group, op.value, ctx));
    }
    case "setClasses":
      return setClassAttr(doc, op.id, op.classes);
    case "setStyle":
      return setStyleSplices(doc, op.id, op.prop, op.value);
    case "insertHtml":
      return insertHtmlSplices(doc, op.parent, op.index, op.html);
    case "remove":
      return removeSplices(doc, op.id);
    case "move":
      return moveSplices(doc, op.id, op.parent, op.index);
    case "duplicate":
      return duplicateSplices(doc, op.id);
    case "wrap":
      return wrapSplices(doc, op.ids, op.html);
    case "setToken":
      return setTokenSplices(doc, op.path, op.value);
  }
}

// src/engine/history.ts
var COALESCE_MS = 1e3;
function undoText(text, tx) {
  let t = text;
  for (let i2 = tx.inverse.length - 1; i2 >= 0; i2--) t = applySplices(t, tx.inverse[i2]);
  return t;
}
function redoText(text, tx) {
  let t = text;
  for (const f of tx.forward) t = applySplices(t, f);
  return t;
}
var History = class {
  done = [];
  undone = [];
  /** Record a transaction; merge it into the previous one when both carry the same key within COALESCE_MS. Clears redo. */
  push(tx) {
    this.undone = [];
    const top = this.done[this.done.length - 1];
    if (top && tx.coalesceKey && top.coalesceKey === tx.coalesceKey && tx.at - top.at <= COALESCE_MS) {
      top.ops.push(...tx.ops);
      top.forward.push(...tx.forward);
      top.inverse.push(...tx.inverse);
      top.at = tx.at;
      return top;
    }
    this.done.push(tx);
    return tx;
  }
  canUndo() {
    return this.done.length > 0;
  }
  canRedo() {
    return this.undone.length > 0;
  }
  /** Move the newest transaction to the redo stack and return it. */
  popUndo() {
    const tx = this.done.pop();
    if (tx) this.undone.push(tx);
    return tx;
  }
  popRedo() {
    const tx = this.undone.pop();
    if (tx) this.done.push(tx);
    return tx;
  }
  get size() {
    return this.done.length;
  }
};

// src/engine/refs.ts
var StaleRefError = class extends Error {
  key;
  constructor(key) {
    super(`node reference ${JSON.stringify(key)} does not resolve to an element in the current document`);
    this.name = "StaleRefError";
    this.key = key;
  }
};
var KeyCounter = class {
  next = 1;
};
var KEY_RE = /^n([0-9a-z]{1,10})$/;
var keyString = (n) => "n" + n.toString(36);
function keyNumber(k) {
  if (typeof k !== "string") return null;
  const m = KEY_RE.exec(k);
  if (!m) return null;
  const n = parseInt(m[1], 36);
  return n > 0 && n <= 4294967295 ? n : null;
}
var FNV = 2166136261;
var mix = (h, c) => Math.imul(h ^ c, 16777619) >>> 0;
function hashStr(h, s) {
  for (let i2 = 0; i2 < s.length; i2++) h = mix(h, s.charCodeAt(i2));
  return h;
}
function hashRange(h, text, a, b) {
  for (let i2 = a; i2 < b; i2++) h = mix(h, text.charCodeAt(i2));
  return h;
}
function signature(n) {
  let h = hashStr(FNV, n.tag);
  for (const name of Object.keys(n.attrs).sort()) {
    h = mix(h, 31);
    h = hashStr(h, name);
    h = mix(h, 61);
    h = hashStr(h, n.attrs[name].value.replace(/\s+/g, " ").trim());
  }
  return h;
}
function ownTextHash(doc, n) {
  if (n.start < 0 || n.startTagEnd < 0) return 0;
  const contentEnd = n.endTagStart ?? n.end;
  let h = FNV;
  let pos = n.startTagEnd;
  for (const c of n.children) {
    const k = doc.nodes[c];
    if (k.start < pos || k.end > contentEnd) continue;
    h = hashRange(h, doc.text, pos, k.start);
    h = mix(h, 30);
    pos = k.end;
  }
  return hashRange(h, doc.text, pos, Math.max(pos, contentEnd));
}
var RefMap = class _RefMap {
  size;
  /** Keys this map minted fresh (not carried from an earlier map), in document order. */
  minted = [];
  gen;
  nums;
  starts;
  tags;
  sigs;
  texts;
  kids;
  index = null;
  constructor(doc, seed) {
    const n = doc.nodes.length;
    this.size = n;
    this.gen = seed?.gen ?? new KeyCounter();
    this.nums = new Uint32Array(n);
    this.starts = new Int32Array(n);
    this.tags = new Array(n);
    this.sigs = new Uint32Array(n);
    this.texts = new Uint32Array(n);
    this.kids = new Uint32Array(n);
    const given = seed?.keys ?? null;
    for (let i2 = 0; i2 < n; i2++) {
      const node = doc.nodes[i2];
      let num = given ? given[i2] : 0;
      if (!num) {
        num = this.gen.next++;
        this.minted.push(keyString(num));
      }
      this.nums[i2] = num;
      this.starts[i2] = node.start;
      this.tags[i2] = node.tag;
      this.sigs[i2] = signature(node);
      this.texts[i2] = ownTextHash(doc, node);
    }
    for (let i2 = 0; i2 < n; i2++) {
      let h = FNV;
      for (const c of doc.nodes[i2].children) h = mix(h, this.nums[c]);
      this.kids[i2] = h;
    }
  }
  lookup() {
    if (!this.index) {
      this.index = /* @__PURE__ */ new Map();
      for (let i2 = 0; i2 < this.size; i2++) this.index.set(this.nums[i2], i2);
    }
    return this.index;
  }
  keyOf(id) {
    if (!Number.isInteger(id) || id < 0 || id >= this.size) throw new RangeError(`no node with id ${id} (document has ${this.size} nodes)`);
    return keyString(this.nums[id]);
  }
  /** The node id the key points at in the current document, or null when the element was removed. */
  idOf(key) {
    const num = keyNumber(key);
    if (num === null) return null;
    return this.lookup().get(num) ?? null;
  }
  keys() {
    return Array.from(this.nums, keyString);
  }
  /**
   * Carry the keys across one edit. `next` is the document the splices produced from this map's document.
   * An element keeps its key when its start offset maps through the splices to a node with the same tag. Elements
   * that sat inside a replaced range are matched to the nodes the replacement created (same tag and attributes,
   * in order); the rest are removed. New elements get fresh keys (`mint` may supply them, for replay).
   */
  rebase(next, splices, mint) {
    const ordered2 = checkSplices(Number.MAX_SAFE_INTEGER, splices);
    const mapStart = (p) => {
      let delta = 0;
      for (const s of ordered2) {
        if (s.start === s.end) {
          if (p >= s.start) delta += s.text.length;
          else break;
        } else {
          if (p < s.start) break;
          if (p < s.end) return -1;
          delta += s.text.length - (s.end - s.start);
        }
      }
      return p + delta;
    };
    const nn = next.nodes.length;
    const keys = new Uint32Array(nn);
    const claimed = new Uint8Array(nn);
    const byStart = /* @__PURE__ */ new Map();
    const unlocated = /* @__PURE__ */ new Map();
    for (const x of next.nodes) {
      if (x.start >= 0) {
        const list2 = byStart.get(x.start);
        if (list2) list2.push(x.id);
        else byStart.set(x.start, [x.id]);
      } else {
        const list2 = unlocated.get(x.tag);
        if (list2) list2.push(x.id);
        else unlocated.set(x.tag, [x.id]);
      }
    }
    const seen = /* @__PURE__ */ new Map();
    const orphans = [];
    for (let i2 = 0; i2 < this.size; i2++) {
      const tag = this.tags[i2];
      const s = this.starts[i2];
      const ord = seen.get(`${s}|${tag}`) ?? 0;
      seen.set(`${s}|${tag}`, ord + 1);
      let target = -1;
      if (s < 0) {
        target = unlocated.get(tag)?.[ord] ?? -1;
      } else {
        const p = mapStart(s);
        if (p >= 0) target = (byStart.get(p) ?? []).filter((id) => next.nodes[id].tag === tag)[ord] ?? -1;
      }
      if (target >= 0 && !claimed[target]) {
        keys[target] = this.nums[i2];
        claimed[target] = 1;
      } else orphans.push(i2);
    }
    if (orphans.length) {
      const cands = [];
      for (let id = 0; id < nn; id++) if (!claimed[id]) cands.push(id);
      const candSig = cands.map((id) => signature(next.nodes[id]));
      const used = new Uint8Array(cands.length);
      const left = [];
      let ptr = 0;
      for (const o of orphans) {
        let hit = -1;
        for (let j = ptr; j < cands.length; j++) {
          if (!used[j] && next.nodes[cands[j]].tag === this.tags[o] && candSig[j] === this.sigs[o]) {
            hit = j;
            break;
          }
        }
        if (hit < 0) {
          left.push(o);
          continue;
        }
        used[hit] = 1;
        ptr = hit + 1;
        keys[cands[hit]] = this.nums[o];
        claimed[cands[hit]] = 1;
      }
      for (const o of left) {
        const hit = cands.findIndex((id, j) => !used[j] && next.nodes[id].tag === this.tags[o]);
        if (hit < 0) continue;
        used[hit] = 1;
        keys[cands[hit]] = this.nums[o];
        claimed[cands[hit]] = 1;
      }
    }
    const taken = /* @__PURE__ */ new Set();
    for (let i2 = 0; i2 < nn; i2++) if (keys[i2]) taken.add(keys[i2]);
    if (mint) {
      for (let i2 = 0; i2 < nn; i2++) {
        if (keys[i2]) continue;
        const num = keyNumber(mint());
        if (num !== null && !taken.has(num)) {
          keys[i2] = num;
          taken.add(num);
        }
      }
    }
    return new _RefMap(next, { gen: this.gen, keys });
  }
  /**
   * Keys for a document that changed outside the editor (no splices known): nodes are matched by tag and attribute
   * signature, in document order (longest common subsequence). Text edits keep their keys; new elements get fresh ones.
   */
  static reconcile(from, next) {
    const nn = next.nodes.length;
    const nextSigs = new Uint32Array(nn);
    for (let i2 = 0; i2 < nn; i2++) nextSigs[i2] = signature(next.nodes[i2]);
    const match = lcs(from.sigs, nextSigs, (i2, j) => from.tags[i2] === next.nodes[j].tag);
    const keys = new Uint32Array(nn);
    for (let i2 = 0; i2 < from.size; i2++) if (match[i2] >= 0) keys[match[i2]] = from.nums[i2];
    return new _RefMap(next, { gen: from.gen, keys });
  }
  /** What changed between two maps of consecutive documents (undo snapshots and transaction ends). */
  static diff(before, after) {
    const out2 = { created: [], removed: [], attrs: [], content: [], structural: false };
    const was = before.lookup();
    const now = after.lookup();
    for (let j = 0; j < after.size; j++) {
      const i2 = was.get(after.nums[j]);
      if (i2 === void 0) {
        out2.created.push(keyString(after.nums[j]));
        continue;
      }
      if (before.kids[i2] !== after.kids[j]) out2.structural = true;
      if (before.texts[i2] !== after.texts[j]) out2.content.push(keyString(after.nums[j]));
      else if (before.sigs[i2] !== after.sigs[j]) out2.attrs.push(keyString(after.nums[j]));
    }
    for (let i2 = 0; i2 < before.size; i2++) if (!now.has(before.nums[i2])) out2.removed.push(keyString(before.nums[i2]));
    if (out2.created.length || out2.removed.length) out2.structural = true;
    return out2;
  }
};
function lcs(a, b, same) {
  const out2 = new Int32Array(a.length).fill(-1);
  const eq = (i3, j2) => a[i3] === b[j2] && same(i3, j2);
  let lo = 0;
  while (lo < a.length && lo < b.length && eq(lo, lo)) {
    out2[lo] = lo;
    lo++;
  }
  let ea = a.length;
  let eb = b.length;
  while (ea > lo && eb > lo && eq(ea - 1, eb - 1)) {
    ea--;
    eb--;
    out2[ea] = eb;
  }
  const n = ea - lo;
  const m = eb - lo;
  if (n === 0 || m === 0) return out2;
  if (n * m > 4e7) return out2;
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i3 = n - 1; i3 >= 0; i3--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      dp[i3 * w + j2] = eq(lo + i3, lo + j2) ? dp[(i3 + 1) * w + j2 + 1] + 1 : Math.max(dp[(i3 + 1) * w + j2], dp[i3 * w + j2 + 1]);
    }
  }
  let i2 = 0;
  let j = 0;
  while (i2 < n && j < m) {
    if (eq(lo + i2, lo + j) && dp[i2 * w + j] === dp[(i2 + 1) * w + j + 1] + 1) {
      out2[lo + i2] = lo + j;
      i2++;
      j++;
    } else if (dp[(i2 + 1) * w + j] >= dp[i2 * w + j + 1]) i2++;
    else j++;
  }
  return out2;
}
function resolveKeyed(op, refs) {
  const o = op;
  if (typeof o !== "object" || o === null) throw new OpError("invalid", "op must be an object");
  const one = (field) => {
    const k = o[field];
    if (typeof k !== "string") throw new OpError("invalid", `op ${JSON.stringify(o.kind)}: field '${field}' must be a node key (string)`);
    const id = refs.idOf(k);
    if (id === null) throw new StaleRefError(k);
    return id;
  };
  switch (o.kind) {
    case "setText":
    case "setAttr":
    case "setUtility":
    case "setClasses":
    case "setStyle":
    case "remove":
    case "duplicate":
      return { ...o, id: one("id") };
    case "insertHtml":
      return { ...o, parent: one("parent") };
    case "move":
      return { ...o, id: one("id"), parent: one("parent") };
    case "wrap": {
      if (!Array.isArray(o.ids)) throw new OpError("invalid", `op "wrap": field 'ids' must be an array of node keys`);
      const ids = o.ids.map((k) => {
        if (typeof k !== "string") throw new OpError("invalid", `op "wrap": field 'ids' must be an array of node keys`);
        const id = refs.idOf(k);
        if (id === null) throw new StaleRefError(k);
        return id;
      });
      return { ...o, ids };
    }
    case "setToken":
      return o;
    default:
      throw new OpError("invalid", `unknown op kind ${JSON.stringify(o.kind)}`);
  }
}

// src/engine/document.ts
var unpatchableCount = (doc) => doc.nodes.reduce((n, x) => n + (x.patchable ? 0 : 1), 0);
var EditorDocument = class _EditorDocument {
  current;
  loaded;
  parsed = null;
  ctx = null;
  history = new History();
  now;
  refMap = null;
  tracking = false;
  keysFrom;
  records = /* @__PURE__ */ new WeakMap();
  constructor(text, opts) {
    this.current = text;
    this.loaded = text;
    this.now = opts.now ?? Date.now;
    this.keysFrom = opts.keysFrom ?? null;
    this.tracking = this.keysFrom !== null;
  }
  static fromText(text, opts = {}) {
    return new _EditorDocument(text, opts);
  }
  get text() {
    return this.current;
  }
  /** The parsed current text (parsed lazily; node ids are valid until the next apply, undo or redo). */
  get doc() {
    if (!this.parsed) this.parsed = parseSource(this.current);
    return this.parsed;
  }
  get tokens() {
    if (!this.ctx) this.ctx = readTokens(this.doc).ctx;
    return this.ctx;
  }
  /** Stable keys for the current document's elements. Immutable: undo and redo swap in the map of that moment. */
  get refs() {
    this.tracking = true;
    if (!this.refMap) this.refMap = this.keysFrom ? RefMap.reconcile(this.keysFrom, this.doc) : new RefMap(this.doc);
    return this.refMap;
  }
  /** Keys the transaction (as returned by apply or applyKeyed) created, in creation order. */
  mintedBy(tx) {
    return [...this.records.get(tx)?.minted ?? []];
  }
  get dirty() {
    return this.current !== this.loaded;
  }
  /**
   * Apply ops as one transaction. Each op resolves against the document produced by the previous one. If any op
   * throws, or would leave a node unpatchable (malformed inserted HTML), nothing changes and nothing is recorded.
   * A transaction that changes nothing is returned but not recorded.
   */
  apply(ops, opts = {}) {
    if (!Array.isArray(ops)) throw new OpError("invalid", "apply expects an array of ops");
    return this.run(ops, false, opts);
  }
  /**
   * Like apply, but ops name elements by NodeKey. Each key is resolved against the document the previous op
   * produced, so `[insertHtml before X, setText X]` works. An unresolvable key throws StaleRefError.
   */
  applyKeyed(ops, opts = {}) {
    if (!Array.isArray(ops)) throw new OpError("invalid", "applyKeyed expects an array of ops");
    return this.run(ops, true, opts);
  }
  run(rawOps, keyed, opts) {
    const startRefs = keyed || this.tracking ? this.refs : null;
    let refs = startRefs;
    const minted = [];
    const reuse = [...opts.reuseKeys ?? []];
    const ops = [];
    let text = this.current;
    let doc = this.doc;
    let ctx = this.tokens;
    const forward = [];
    const inverse = [];
    rawOps.forEach((raw, i2) => {
      let splices;
      let op;
      try {
        op = keyed ? resolveKeyed(raw, refs) : raw;
        ops.push(op);
        splices = resolveOp(doc, op, ctx);
      } catch (e) {
        if (e instanceof OpError && rawOps.length > 1) e.message = `op ${i2} (${raw.kind}): ${e.message}`;
        throw e;
      }
      if (splices.length === 0) {
        forward.push([]);
        inverse.push([]);
        return;
      }
      const next = applySplices(text, splices);
      const nextDoc = parseSource(next);
      if (unpatchableCount(nextDoc) > unpatchableCount(doc)) {
        throw new OpError("invalid", `op ${i2} (${op.kind}) would produce markup the parser relocates (unbalanced or misnested HTML)`);
      }
      forward.push(splices);
      inverse.push(invertSplices(text, splices));
      if (op.kind === "setToken") ctx = readTokens(nextDoc).ctx;
      if (refs) {
        refs = refs.rebase(nextDoc, splices, () => reuse.shift());
        minted.push(...refs.minted);
      }
      text = next;
      doc = nextDoc;
    });
    const tx = {
      label: opts.label ?? ops.map((o) => o.kind).join(", "),
      ops,
      forward,
      inverse,
      at: this.now(),
      ...opts.coalesceKey ? { coalesceKey: opts.coalesceKey } : {}
    };
    if (text === this.current) return tx;
    this.current = text;
    this.parsed = doc;
    this.ctx = ctx;
    this.refMap = refs;
    const kept = this.history.push(tx);
    if (refs && startRefs) {
      const prior = this.records.get(kept);
      if (prior && kept !== tx) {
        this.records.set(kept, { before: prior.before, after: refs, minted: [...prior.minted, ...minted] });
      } else {
        this.records.set(kept, { before: startRefs, after: refs, minted });
      }
    }
    return kept;
  }
  undo() {
    const tx = this.history.popUndo();
    if (!tx) return false;
    this.setText(undoText(this.current, tx));
    this.refMap = this.records.get(tx)?.before ?? null;
    return true;
  }
  redo() {
    const tx = this.history.popRedo();
    if (!tx) return false;
    this.setText(redoText(this.current, tx));
    this.refMap = this.records.get(tx)?.after ?? null;
    return true;
  }
  canUndo() {
    return this.history.canUndo();
  }
  canRedo() {
    return this.history.canRedo();
  }
  /** Ids of `section.slide` elements, document order. */
  slides() {
    return this.doc.nodes.filter((n) => n.tag === "section" && classList(n).includes("slide")).map((n) => n.id);
  }
  setText(text) {
    this.current = text;
    this.parsed = null;
    this.ctx = null;
  }
};

// src/engine/file-store.ts
import { createHash, randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
var ConflictError = class extends Error {
  diskFingerprint;
  constructor(path, expected, diskFingerprint2) {
    super(`${path} changed on disk since it was loaded (expected ${expected.slice(0, 12)}, found ${diskFingerprint2.slice(0, 12)}); refusing to overwrite. Reload the file and apply the edit again.`);
    this.name = "ConflictError";
    this.diskFingerprint = diskFingerprint2;
  }
};
var SNAPSHOT_LIMIT = 30;
var sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function diskFingerprint(path) {
  return sha256(await readFile(path));
}
function historyDir(deckPath) {
  return join(dirname(deckPath), ".nevermind", "history");
}
async function loadDeck(path) {
  const bytes = await readFile(path);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error(`${path} is not valid UTF-8; refusing to load it because saving would change bytes the edit did not touch`);
  }
  return { path, text, fingerprint: sha256(bytes) };
}
function snapshotName(deckPath, now, tag) {
  const iso = now.toISOString().replace(/:/g, "-");
  return `${basename(deckPath)}.${iso}${tag ? `.${tag}` : ""}.html`;
}
async function listSnapshots(deckPath) {
  const dir = historyDir(deckPath);
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const prefix = basename(deckPath) + ".";
  return names.filter((n) => n.startsWith(prefix) && n.endsWith(".html") && /^\d{4}-\d\d-\d\dT/.test(n.slice(prefix.length))).sort().map((name) => ({ path: join(dir, name), name, preUndo: name.endsWith(".pre-undo.html") }));
}
async function takeSnapshot(deckPath, tag = "") {
  const dir = historyDir(deckPath);
  await mkdir(dir, { recursive: true });
  const existing = new Set((await listSnapshots(deckPath)).map((s) => s.name));
  let now = /* @__PURE__ */ new Date();
  let name = snapshotName(deckPath, now, tag);
  const all = [...existing].sort();
  while (existing.has(name) || all.length && name <= all[all.length - 1]) {
    now = new Date(now.getTime() + 1);
    name = snapshotName(deckPath, now, tag);
  }
  const target = join(dir, name);
  await copyFile(deckPath, target);
  const snaps = await listSnapshots(deckPath);
  for (const s of snaps.slice(0, Math.max(0, snaps.length - SNAPSHOT_LIMIT))) await unlink(s.path);
  return target;
}
async function atomicWrite(path, bytes) {
  const tmp = join(dirname(path), `.${basename(path)}.nm-tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  let mode;
  try {
    mode = (await stat(path)).mode & 4095;
  } catch {
  }
  try {
    await writeFile(tmp, bytes, { flag: "wx" });
    if (mode !== void 0) await chmod(tmp, mode);
    await rename(tmp, path);
  } catch (e) {
    await unlink(tmp).catch(() => {
    });
    throw e;
  }
}
async function saveDeck(file, nextText, opts = {}) {
  return save(file, nextText, opts.snapshot ?? true, "");
}
async function save(file, nextText, snapshot, tag) {
  const hadBom = file.text.charCodeAt(0) === 65279;
  let text = nextText;
  if (hadBom && text.charCodeAt(0) !== 65279) text = "\uFEFF" + text;
  if (!hadBom && text.charCodeAt(0) === 65279) text = text.slice(1);
  if (text === file.text) return file;
  const disk = await diskFingerprint(file.path);
  if (disk !== file.fingerprint) throw new ConflictError(file.path, file.fingerprint, disk);
  if (snapshot) await takeSnapshot(file.path, tag);
  const bytes = Buffer.from(text, "utf8");
  await atomicWrite(file.path, bytes);
  return { path: file.path, text, fingerprint: sha256(bytes) };
}
async function restoreLatestSnapshot(deckPath) {
  const snaps = (await listSnapshots(deckPath)).filter((s) => !s.preUndo);
  const latest = snaps[snaps.length - 1];
  if (!latest) return null;
  const current2 = await loadDeck(deckPath);
  const restoredText = (await readFile(latest.path)).toString("utf8");
  let file = current2;
  if (restoredText === current2.text) {
  } else {
    await takeSnapshot(deckPath, "pre-undo");
    const bytes = Buffer.from(restoredText, "utf8");
    if (await diskFingerprint(deckPath) !== current2.fingerprint) throw new ConflictError(deckPath, current2.fingerprint, await diskFingerprint(deckPath));
    await atomicWrite(deckPath, bytes);
    file = { path: deckPath, text: restoredText, fingerprint: sha256(bytes) };
  }
  await unlink(latest.path);
  return { file, restored: latest.name };
}

// src/engine/deck-adapter.ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
var isSlide = (n) => n.tag === "section" && classList(n).includes("slide");
var isStage = (n) => classList(n).includes("deck-stage") || findAttr(n, "id")?.value === "slides-stage";
function styleSheets(doc) {
  return doc.nodes.filter((n) => n.tag === "style" && n.endTagStart !== null).map((node) => ({ node, css: doc.text.slice(node.startTagEnd, node.endTagStart) }));
}
var stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
var unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, "$2");
function parseWeights(v) {
  if (!v) return [400];
  const words = v.trim().split(/\s+/).map((w) => w === "normal" ? 400 : w === "bold" ? 700 : Number(w));
  if (words.some((w) => !Number.isFinite(w))) return [400];
  if (words.length === 2) {
    const out2 = [];
    for (let w = Math.ceil(words[0] / 100) * 100; w <= words[1]; w += 100) out2.push(w);
    return out2;
  }
  return [words[0]];
}
function fontFaces(doc) {
  const byFamily = /* @__PURE__ */ new Map();
  for (const { css } of styleSheets(doc)) {
    for (const m of stripComments(css).matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = m[1];
      const fam = /font-family\s*:\s*([^;]+)/.exec(body);
      if (!fam) continue;
      const family = unquote(fam[1]);
      const weights = parseWeights(/font-weight\s*:\s*([^;]+)/.exec(body)?.[1]);
      const src = [...(/(?:^|;)\s*src\s*:\s*([^;]+)/.exec(body)?.[1] ?? "").matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map((u) => u[2]);
      const entry = byFamily.get(family) ?? byFamily.set(family, { weights: /* @__PURE__ */ new Set(), src: [] }).get(family);
      weights.forEach((w) => entry.weights.add(w));
      for (const s of src) if (!entry.src.includes(s)) entry.src.push(s);
    }
  }
  return [...byFamily].map(([family, e]) => ({ family, weights: [...e.weights].sort((a, b) => a - b), src: e.src }));
}
function slideOf(doc, id, slides) {
  return slides.find((s) => isWithin(doc, id, s)) ?? -1;
}
function inlineVariables(value) {
  const variables = {};
  for (const declaration of value.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim();
    const variable = declaration.slice(colon + 1).trim();
    if (/^--anatomy-[\w-]+$/i.test(name) && variable) variables[name] = variable;
  }
  return variables;
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function inspectDeck(doc) {
  const slideNodes = doc.nodes.filter(isSlide);
  const slideIds = slideNodes.map((n) => n.id);
  const fonts = fontFaces(doc);
  const morph = {};
  const zoomSteps = [];
  const entrances = [];
  const anatomy = [];
  for (const n of doc.nodes) {
    const m = findAttr(n, "data-morph");
    if (m && m.value) (morph[m.value] ??= []).push(n.id);
    const z = findAttr(n, "data-zoom-step");
    if (z) {
      zoomSteps.push({ slideId: slideOf(doc, n.id, slideIds), id: n.id, step: Number(z.value), label: findAttr(n, "data-zoom-label")?.value ?? null });
    }
    const entrance = findAttr(n, "data-entrance");
    const legacyDelay = classList(n).map((name) => /^d(\d+)$/.exec(name)).find(Boolean);
    if (entrance?.value || classList(n).includes("reveal")) {
      entrances.push({
        slideId: slideOf(doc, n.id, slideIds),
        id: n.id,
        kind: entrance?.value || "reveal",
        order: Number(findAttr(n, "data-entrance-order")?.value ?? legacyDelay?.[1] ?? 1),
        delay: Number(findAttr(n, "data-entrance-delay")?.value ?? 0),
        legacy: !entrance
      });
    }
    if (n.tag === "svg" || n.tag === "iframe") {
      const anatomyName = findAttr(n, "data-anatomy")?.value;
      const src = findAttr(n, "src")?.value ?? "";
      const marked = anatomyName !== void 0 || classList(n).some((name) => /(?:^|-)anatomy(?:-|$)/i.test(name)) || /(?:^|\/)anatomy(?:\/|-)/i.test(src);
      const variables = inlineVariables(findAttr(n, "style")?.value ?? "");
      if (marked || Object.keys(variables).length) anatomy.push({
        slideId: slideOf(doc, n.id, slideIds),
        id: n.id,
        kind: n.tag,
        name: anatomyName || src.split("/").pop()?.split(/[?#]/)[0] || n.tag,
        variables
      });
    }
  }
  const tokenValues = readTokens(doc).values;
  const theme = objectValue(tokenValues.theme);
  const extend2 = objectValue(theme.extend);
  const colours = Object.fromEntries([...flattenColors(theme.colors), ...flattenColors(extend2.colors)]);
  const identityFonts = { ...objectValue(theme.fontFamily), ...objectValue(extend2.fontFamily) };
  const runtimeMeta = doc.nodes.find((n) => n.tag === "meta" && findAttr(n, "name")?.value === "nm-runtime");
  const runtimeVersion = runtimeMeta ? Number(findAttr(runtimeMeta, "content")?.value) : null;
  const scripts = doc.nodes.filter((n) => n.tag === "script" && /tailwind/i.test(findAttr(n, "src")?.value ?? ""));
  const tailwind = scripts.some((n) => /^(https?:)?\/\//i.test(findAttr(n, "src").value)) ? "cdn" : scripts.length ? "local" : "none";
  const markers = Object.keys(morph).length > 0 || zoomSteps.length > 0 || doc.nodes.some((n) => classList(n).includes("camera-rig") || findAttr(n, "data-slide") !== void 0) || fonts.some((f) => /thmanyah|komission/i.test(f.family));
  const kind = slideNodes.length === 0 ? "generic" : markers ? "nevermind" : "frontend-slides";
  const titleOf = (s) => {
    const h = doc.nodes.find((n) => /^h[1-3]$/.test(n.tag) && isWithin(doc, n.id, s.id));
    if (!h) return null;
    try {
      return visibleText(doc, h.id).replace(/\n/g, " ") || null;
    } catch {
      return null;
    }
  };
  return {
    kind,
    slides: slideNodes.map((s, index) => ({ id: s.id, index, title: titleOf(s) })),
    tokens: readTokens(doc).ctx,
    fonts,
    morph,
    zoomSteps,
    entrances,
    anatomy,
    identity: { colours, fonts: identityFonts },
    runtime: { version: runtimeVersion !== null && Number.isFinite(runtimeVersion) ? runtimeVersion : null, native: runtimeMeta !== void 0 },
    tailwind,
    legacyEditor: doc.nodes.some((n) => findAttr(n, "data-edit") !== void 0)
  };
}
var EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
var ARABIC_LETTER = /[ء-يٱ-ۓۺ-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
var ARABIC_DIGIT = /[٠-٩۰-۹]/;
var WESTERN_DIGIT = /[0-9]/;
var EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
var ALPHA_COLOR = /^(text|bg|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(.+)\/(\d+|\[[^\]]+\])$/;
function hiddenText(doc, id) {
  for (let p = id; p !== null; p = doc.nodes[p].parent) {
    const t = doc.nodes[p].tag;
    if (RAW_TEXT_TAGS.has(t) || t === "template") return true;
  }
  return false;
}
function assetRefs(doc) {
  const refs = [];
  const cssUrls = (css) => [...stripComments(css).matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map((m) => m[2]);
  for (const n of doc.nodes) {
    if (!n.patchable && n.start < 0) continue;
    const add = (ref2) => {
      if (ref2 && ref2.trim()) refs.push({ nodeId: n.id, ref: ref2.trim() });
    };
    if (["img", "script", "iframe", "source", "video", "audio", "embed", "track", "input"].includes(n.tag)) add(findAttr(n, "src")?.value);
    if (n.tag === "video") add(findAttr(n, "poster")?.value);
    if (n.tag === "link" && /\b(stylesheet|icon|preload|manifest)\b/i.test(findAttr(n, "rel")?.value ?? "")) add(findAttr(n, "href")?.value);
    if (n.ns === "svg" && (n.tag === "image" || n.tag === "use")) {
      add(findAttr(n, "href")?.value);
      add(findAttr(n, "xlink:href")?.value);
    }
    const srcset = findAttr(n, "srcset")?.value;
    if (srcset) for (const part of srcset.split(",")) add(part.trim().split(/\s+/)[0]);
    const style = findAttr(n, "style")?.value;
    if (style) cssUrls(style).forEach(add);
    if (n.tag === "style" && n.endTagStart !== null) cssUrls(doc.text.slice(n.startTagEnd, n.endTagStart)).forEach(add);
  }
  return refs.filter((r) => !EXTERNAL.test(r.ref));
}
function cssVariables(doc) {
  const vars = /* @__PURE__ */ new Map();
  for (const { css } of styleSheets(doc)) {
    for (const m of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  }
  return vars;
}
function familyOf(token, values, vars) {
  const theme = values.theme ?? {};
  const raw = theme.extend?.fontFamily?.[token] ?? theme.fontFamily?.[token];
  let v = Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : null;
  for (let i2 = 0; v && i2 < 5; i2++) {
    const m = /^\s*var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)\s*$/.exec(v);
    if (!m) break;
    v = vars.get(m[1]) ?? m[2] ?? null;
  }
  if (!v) return null;
  return unquote(v.split(",")[0]);
}
function lintDeck(doc, info, deckDir) {
  const issues = [];
  const ctx = info.tokens;
  const push = (code, severity, nodeId, message) => issues.push({ code, severity, nodeId, message });
  const body = doc.nodes.find((n) => n.tag === "body");
  if (body) {
    for (const s of doc.textSegments(body.id)) {
      if (hiddenText(doc, s.nodeId)) continue;
      const m = EMOJI.exec(s.decoded);
      if (m) push("emoji", "error", s.nodeId, `emoji ${JSON.stringify(m[0])} in text of <${doc.nodes[s.nodeId].tag}> (node ${s.nodeId})`);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (const r of assetRefs(doc)) {
    const clean = r.ref.replace(/[?#].*$/, "");
    let rel = clean;
    try {
      rel = decodeURIComponent(clean);
    } catch {
    }
    const key = `${r.nodeId}:${rel}`;
    if (seen.has(key) || rel === "") continue;
    seen.add(key);
    if (!existsSync(resolve(deckDir, rel))) push("missing-asset", "error", r.nodeId, `asset not found: ${r.ref}`);
  }
  for (const s of info.slides) {
    const n = doc.nodes[s.id];
    if (classList(n).includes("relative")) {
      push("slide-relative", "error", s.id, `slide ${s.index + 1} has class "relative"; slides must stay absolutely positioned on the stage`);
    }
  }
  if (info.slides.length && !doc.nodes.some(isStage)) push("no-stage", "error", null, "slides exist but there is no 1920x1080 stage (.deck-stage or #slides-stage)");
  const values = readTokens(doc).values;
  const theme = values.theme ?? {};
  const colorValues = new Map([...flattenColors(theme.colors), ...flattenColors(theme.extend?.colors)]);
  for (const n of doc.nodes) {
    for (const c of classList(n)) {
      const base = c.split(":").pop().replace(/^!|!$/g, "").replace(/^-/, "");
      const m = ALPHA_COLOR.exec(base);
      if (!m) continue;
      const v = colorValues.get(m[2]);
      if (typeof v === "string" && /^\s*var\(/.test(v) && !v.includes("<alpha-value>")) {
        push("alpha-on-var-color", "warn", n.id, `${c}: colour "${m[2]}" is ${v}, so Tailwind cannot apply the /${m[3]} opacity and emits no rule`);
      }
    }
  }
  for (const n of doc.nodes) {
    const tr = classList(n).map((c) => parseToken(c, ctx)).find((t) => t.group === "tracking" && t.variants.length === 0 && t.value !== "normal");
    if (!tr) continue;
    let text = "";
    try {
      text = visibleText(doc, n.id);
    } catch {
      continue;
    }
    if (ARABIC_LETTER.test(text)) push("letter-spacing-arabic", "warn", n.id, `${tr.raw} on Arabic text breaks the joining of letters`);
  }
  for (const s of info.slides) {
    let text = "";
    try {
      text = visibleText(doc, s.id);
    } catch {
      continue;
    }
    if (ARABIC_DIGIT.test(text) && WESTERN_DIGIT.test(text)) {
      push("mixed-digits", "warn", s.id, `slide ${s.index + 1} mixes Arabic-Indic and Western digits`);
    }
  }
  const vars = cssVariables(doc);
  const faces = new Map(info.fonts.map((f) => [f.family.toLowerCase(), f]));
  for (const n of doc.nodes) {
    const w = classList(n).map((c) => parseToken(c, ctx)).find((t) => t.group === "font-weight" && t.variants.length === 0);
    if (!w || !w.value) continue;
    const weight = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }[w.value] ?? Number(w.value.replace(/^\[|\]$/g, ""));
    let family = null;
    for (let p = n.id; p !== null && family === null; p = doc.nodes[p].parent) {
      const f = classList(doc.nodes[p]).map((c) => parseToken(c, ctx)).find((t) => t.group === "font-family" && t.variants.length === 0);
      if (f && f.value) family = f.value.startsWith("[") ? unquote(f.value.slice(1, -1).replace(/_/g, " ")) : familyOf(f.value, values, vars);
    }
    const face = family ? faces.get(family.toLowerCase()) : void 0;
    if (face && Number.isFinite(weight) && !face.weights.includes(weight)) {
      push("missing-font-weight", "warn", n.id, `${w.raw} asks for weight ${weight} of "${face.family}", which only has ${face.weights.join(", ")}`);
    }
  }
  if (info.tailwind === "cdn") {
    const s = doc.nodes.find((n) => n.tag === "script" && /tailwind/i.test(findAttr(n, "src")?.value ?? ""));
    push("tailwind-cdn", "warn", s?.id ?? null, "Tailwind is loaded from the CDN; the deck needs a network connection to render");
  }
  return issues;
}

// src/engine/outline.ts
function outline(doc, id, depth, keyOf) {
  const n = doc.byId(id);
  let text = "";
  try {
    text = visibleText(doc, id).replace(/\n/g, " ").slice(0, 80);
  } catch {
  }
  const kids = n.children.filter((c) => doc.nodes[c].start >= 0);
  const node = { id, ...keyOf ? { key: keyOf(id) } : {}, tag: n.tag, classes: classList(n), text, children: [] };
  if (depth > 0) node.children = kids.map((c) => outline(doc, c, depth - 1, keyOf));
  else if (kids.length) node.truncated = kids.length;
  return node;
}

// src/server/server.ts
import { randomBytes as randomBytes3 } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath as realpath3, stat as stat4 } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname as dirname9, extname as extname4, resolve as resolve6 } from "node:path";

// src/server/assets.ts
var EDIT_MODE_JS = `// Edit layer (from spike S2b), injected as the first child of <head>, so it runs before any deck script.
// Exposes window.__nm inside the preview frame.
// S2b: the freeze now reaches same-origin child frames (rAF gate, CSS pause, WAAPI/SMIL pause, key swallow).
(function () {
  'use strict';
  var root = document.documentElement;
  var frozen = true;
  var warnings = [];
  var textSession = null;
  root.setAttribute('data-nm-edit', '');

  function warn(code) {
    if (warnings.indexOf(code) < 0) warnings.push(code);
  }

  // --- legacy localStorage editors -------------------------------------------------------------
  // The decks ship their own inline editors that restore saved edits with el.innerHTML = ... on load.
  // That rewrites text nodes behind the source model (children lose data-nm-key) and would show text that
  // is not in the file. Inside the preview, localStorage is an empty in-memory store, so the deck neither
  // reads old edits nor writes new ones into the user's browser storage.
  try {
    var mem = Object.create(null);
    var shim = {
      getItem: function (k) { return k in mem ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = Object.create(null); },
      key: function (i) { var ks = Object.keys(mem); return i < ks.length ? ks[i] : null; },
    };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(mem).length; } });
    Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim; } });
  } catch (e) {
    warn('localstorage-shim-failed');
  }

  // --- requestAnimationFrame gate -------------------------------------------------------------
  // While frozen, callbacks are parked (not run); on unfreeze they are scheduled again.
  // One gate per window: the deck window and every same-origin child frame.
  var gates = []; // every installed gate, so freeze(false) can release all of them
  function installGate(win) {
    if (win.__nmGate) return win.__nmGate;
    var nativeRAF = win.requestAnimationFrame.bind(win);
    var nativeCAF = win.cancelAnimationFrame.bind(win);
    var seq = 0;
    var live = new Map(); // our id -> native id
    var parked = new Map(); // our id -> callback
    function schedule(id, cb) {
      var nid = nativeRAF(function (t) {
        live.delete(id);
        if (frozen) {
          parked.set(id, cb);
          return;
        }
        cb(t);
      });
      live.set(id, nid);
    }
    win.requestAnimationFrame = function (cb) {
      var id = ++seq;
      if (frozen) parked.set(id, cb);
      else schedule(id, cb);
      return id;
    };
    win.cancelAnimationFrame = function (id) {
      if (live.has(id)) {
        nativeCAF(live.get(id));
        live.delete(id);
      }
      parked.delete(id);
    };
    var gate = {
      win: win,
      release: function () {
        var items = Array.from(parked.entries());
        parked.clear();
        items.forEach(function (kv) {
          schedule(kv[0], kv[1]);
        });
      },
      parkedCount: function () {
        return parked.size;
      },
    };
    win.__nmGate = gate;
    gates.push(gate);
    return gate;
  }
  var rootGate = installGate(window);

  // --- input swallowing -----------------------------------------------------------------------
  // Capture phase on window, registered before any deck listener. Propagation stops while frozen;
  // the default action is kept inside contenteditable so a text session can still type.
  function swallow(e) {
    if (!frozen) return;
    var inSession = textSession && (e.target === textSession.el || textSession.el.contains(e.target));
    if (inSession && e.type === 'keydown') {
      var mod = e.ctrlKey || e.metaKey;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchTextCommand(endText(false), false);
        return;
      }
      if (mod && (e.code === 'Enter' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchTextCommand(endText(true), e.code === 'KeyS');
        return;
      }
    }
    e.stopImmediatePropagation();
    var t = e.target;
    if (!(t && t.isContentEditable)) e.preventDefault();
  }
  var SWALLOWED = ['keydown', 'keyup', 'click', 'dblclick', 'wheel'];
  function swallowOn(win) {
    SWALLOWED.forEach(function (type) {
      win.addEventListener(type, swallow, { capture: true, passive: false });
    });
  }
  swallowOn(window);

  // Capture before deck-owned [data-edit] listeners. Default editing and native undo still run.
  window.addEventListener('input', function (e) {
    if (textSession && (e.target === textSession.el || textSession.el.contains(e.target))) e.stopImmediatePropagation();
  }, true);
  window.addEventListener('paste', function (e) {
    if (!textSession || !(e.target === textSession.el || textSession.el.contains(e.target))) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain').replace(/\\r\\n?/g, '\\n') : '';
    document.execCommand('insertText', false, text);
  }, true);

  // --- warnings -------------------------------------------------------------------------------
  window.addEventListener(
    'error',
    function (e) {
      var t = e.target;
      if (t && t.tagName === 'SCRIPT' && t.src) {
        if (/cdn\\.tailwindcss\\.com/.test(t.src)) warn('tailwind-cdn-unreachable');
        else if (/tailwind/i.test(t.src)) warn('tailwind-script-failed');
        else warn('script-failed:' + t.src);
      }
    },
    true,
  );

  // --- same-origin child frames ---------------------------------------------------------------
  // Present at load or added later. A child gets: rAF gate, a pause stylesheet, key swallowing.
  // Cross-origin frames cannot be reached: they raise a warning instead.
  var CHILD_CSS =
    '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' +
    'html{pointer-events:none!important}'; // child pointer handlers (hover steering) must not fire in edit mode
  var childDocs = []; // { doc, style }
  var watched = new WeakSet(); // iframe elements we already hook

  function patchChildDoc(iframe) {
    var win, doc;
    try {
      win = iframe.contentWindow;
      doc = iframe.contentDocument;
    } catch (e) {
      doc = null;
    }
    if (!win || !doc) {
      warn('cross-origin-frame:' + (iframe.getAttribute('src') || ''));
      return;
    }
    if (win.__nmGate) return; // this window object is already patched
    if (!doc.documentElement) return; // document not created yet
    if (doc.URL === 'about:blank' && iframe.getAttribute('src')) return; // navigation not committed yet
    installGate(win);
    swallowOn(win);
    var style = doc.createElement('style');
    style.id = 'nm-edit-child-css';
    style.textContent = CHILD_CSS;
    style.media = frozen ? 'all' : 'not all';
    (doc.head || doc.documentElement).appendChild(style);
    childDocs.push({ doc: doc, style: style });
    if (frozen) pauseScriptAnimations(doc);
    applyAnatomyOverrides(iframe, doc);
    watchFrames(doc); // frames inside the child
  }

  // CSS custom properties do not inherit through an iframe boundary. Persist overrides on the iframe host, then
  // mirror them onto declarations inside the same-origin anatomy document for an immediate, source-backed preview.
  function applyAnatomyOverrides(iframe, doc) {
    if (!iframe || !doc) return;
    var names = [];
    for (var i = 0; i < iframe.style.length; i++) if (/^--anatomy-/.test(iframe.style[i])) names.push(iframe.style[i]);
    if (!names.length) return;
    var targets = Array.prototype.slice.call(doc.querySelectorAll('[style]')).filter(function (el) {
      return names.some(function (name) { return el.style.getPropertyValue(name); });
    });
    if (!targets.length && doc.documentElement) targets.push(doc.documentElement);
    targets.forEach(function (target) {
      names.forEach(function (name) { target.style.setProperty(name, iframe.style.getPropertyValue(name)); });
    });
  }

  function hookFrame(iframe) {
    if (watched.has(iframe)) return;
    watched.add(iframe);
    iframe.addEventListener('load', function () {
      patchChildDoc(iframe);
    });
    patchChildDoc(iframe); // already loaded (or in-flight): no-op until its document is committed
    // Earlier hook: poll for the moment the new document exists, before its scripts have all run.
    var tries = 0;
    (function poll() {
      var w;
      try {
        w = iframe.contentWindow;
        if (w && w.__nmGate) return;
        if (w && w.document && w.document.URL !== 'about:blank' && w.document.readyState === 'loading') {
          patchChildDoc(iframe);
          if (w.__nmGate) return;
        }
      } catch (e) {
        return;
      }
      if (++tries < 400) setTimeout(poll, 0);
    })();
  }

  function watchFrames(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('iframe'), hookFrame);
    var mo = new (doc.defaultView.MutationObserver || MutationObserver)(function (list) {
      list.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IFRAME') hookFrame(n);
          else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('iframe'), hookFrame);
        });
      });
    });
    mo.observe(doc, { childList: true, subtree: true });
  }
  watchFrames(document);

  // --- script-driven animations (WAAPI, SMIL) -------------------------------------------------
  var pausedByUs = [];
  function pauseScriptAnimations(doc) {
    // Script-driven Web Animations (el.animate) are not covered by the CSS rule.
    doc.getAnimations().forEach(function (a) {
      var w = doc.defaultView;
      var css = (typeof w.CSSAnimation !== 'undefined' && a instanceof w.CSSAnimation) ||
        (typeof w.CSSTransition !== 'undefined' && a instanceof w.CSSTransition);
      if (!css && a.playState === 'running') {
        a.pause();
        pausedByUs.push(a);
      }
    });
    Array.prototype.forEach.call(doc.querySelectorAll('svg'), function (s) {
      if (s.pauseAnimations && !s.animationsPaused()) {
        s.pauseAnimations();
        pausedByUs.push({ play: function () { s.unpauseAnimations(); } });
      }
    });
  }

  // --- slides ---------------------------------------------------------------------------------
  function slides() {
    return Array.prototype.slice.call(document.querySelectorAll('.slide'));
  }
  // Sets data-nm-current, and mirrors the deck's own state classes so deck CSS keyed on
  // .slide.active / .slide.visible (bars, image zoom, reveal variants) shows its final state too.
  function goTo(i) {
    var before = document.querySelector('.slide[data-nm-current]');
    var beforeRects = {};
    if (before) Array.prototype.forEach.call(before.querySelectorAll('[data-morph]'), function (el) {
      beforeRects[el.getAttribute('data-morph')] = el.getBoundingClientRect();
    });
    slides().forEach(function (s, k) {
      var on = k === i;
      if (on) s.setAttribute('data-nm-current', '');
      else s.removeAttribute('data-nm-current');
      s.classList.toggle('active', on);
      s.classList.toggle('visible', on);
    });
    var after = slides()[i];
    if (after && before !== after) Array.prototype.forEach.call(after.querySelectorAll('[data-morph]'), function (el) {
      var from = beforeRects[el.getAttribute('data-morph')];
      if (!from || typeof el.animate !== 'function') return;
      var to = el.getBoundingClientRect();
      var sx = to.width ? from.width / to.width : 1;
      var sy = to.height ? from.height / to.height : 1;
      el.animate([
        { transformOrigin: 'top left', transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + sx + ',' + sy + ')', opacity: 0.55 },
        { transformOrigin: 'top left', transform: 'none', opacity: 1 },
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  function resetMotion() {
    slides().forEach(function (slide) {
      slide.removeAttribute('data-nm-motion-preview');
      slide.classList.remove('is-camera-zoomed');
      Array.prototype.forEach.call(slide.querySelectorAll('.zoom-focused'), function (el) { el.classList.remove('zoom-focused'); });
    });
  }

  function previewEntrance(slideIndex) {
    resetMotion();
    goTo(slideIndex);
    var slide = slides()[slideIndex];
    if (!slide) return;
    var items = Array.prototype.slice.call(slide.querySelectorAll('[data-entrance], .reveal'));
    items.sort(function (a, b) {
      return Number(a.getAttribute('data-entrance-order') || ((a.className || '').match(/\\bd(\\d+)\\b/) || [0, 1])[1]) -
        Number(b.getAttribute('data-entrance-order') || ((b.className || '').match(/\\bd(\\d+)\\b/) || [0, 1])[1]);
    });
    items.forEach(function (el, index) {
      if (typeof el.animate !== 'function') return;
      var kind = el.getAttribute('data-entrance') || 'reveal';
      var first = { opacity: 0, transform: kind === 'scale' ? 'scale(.88)' : kind === 'slide-right' ? 'translateX(70px)' : kind === 'fade' ? 'none' : 'translateY(48px)' };
      el.animate([first, { opacity: 1, transform: 'none' }], {
        duration: 480,
        delay: Number(el.getAttribute('data-entrance-delay') || index * 120),
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both',
      });
    });
  }

  function previewZoom(slideIndex, step) {
    resetMotion();
    goTo(slideIndex);
    var slide = slides()[slideIndex];
    if (!slide) return;
    slide.setAttribute('data-nm-motion-preview', 'zoom');
    slide.classList.add('is-camera-zoomed');
    var target = slide.querySelector('[data-zoom-step="' + Number(step) + '"]');
    if (target) target.classList.add('zoom-focused');
  }

  function freeze(on) {
    frozen = !!on;
    if (frozen) {
      root.setAttribute('data-nm-edit', '');
      pauseScriptAnimations(document);
      childDocs.forEach(function (c) {
        c.style.media = 'all';
        pauseScriptAnimations(c.doc);
      });
    } else {
      root.removeAttribute('data-nm-edit');
      childDocs.forEach(function (c) {
        c.style.media = 'not all';
      });
      pausedByUs.forEach(function (a) {
        a.play();
      });
      pausedByUs = [];
      gates.forEach(function (g) {
        g.release();
      });
    }
  }

  // --- plaintext text sessions ---------------------------------------------------------------
  function keyedElement(key) {
    return document.querySelector('[data-nm-key="' + String(key).replace(/[^a-z0-9]/gi, '') + '"]');
  }

  function editableText(el) {
    if (!el || /^(IMG|SVG|IFRAME|VIDEO|CANVAS|PICTURE|SCRIPT|STYLE)$/.test(el.tagName)) return false;
    return (el.textContent || '').trim().length > 0;
  }

  function textNodes(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function normaliseBegin(el) {
    var nodes = textNodes(el);
    nodes.forEach(function (n) { n.data = n.data.replace(/\\s+/g, ' '); });
    if (nodes.length) {
      nodes[0].data = nodes[0].data.replace(/^\\s+/, '');
      nodes[nodes.length - 1].data = nodes[nodes.length - 1].data.replace(/\\s+$/, '');
    }
  }

  function sessionText(el) {
    function lineContainer(n) {
      return n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName);
    }
    function read(n) {
      if (n.nodeType === 3) return n.data;
      if (n.nodeType !== 1) return '';
      if (n.tagName === 'BR') return '\\n';
      var s = '';
      var previousWasLine = false;
      Array.prototype.forEach.call(n.childNodes, function (c) {
        var isLine = lineContainer(c);
        // Chromium represents Enter in plaintext-only contenteditable as sibling DIVs (and, depending on the
        // edit shape, text followed by a DIV). textContent omits those visual line boundaries, so preserve them
        // explicitly just as we preserve BR. Existing inline spans remain contiguous.
        if ((isLine || previousWasLine) && s && s.charAt(s.length - 1) !== '\\n') s += '\\n';
        s += read(c);
        previousWasLine = isLine;
      });
      return s;
    }
    return read(el).replace(/\\r\\n?/g, '\\n').replace(/\\u00a0/g, ' ').replace(/\\n$/, '');
  }

  function placeCaretEnd(el) {
    var sel = window.getSelection();
    if (!sel) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function beginText(key) {
    if (textSession && textSession.key === key) return { key: key, text: sessionText(textSession.el) };
    if (textSession) endText(true);
    var el = keyedElement(key);
    if (!editableText(el)) return null;
    var prior = el.getAttribute('contenteditable');
    var priorSpellcheck = el.getAttribute('spellcheck');
    var original = el.innerHTML;
    normaliseBegin(el);
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'true');
    el.setAttribute('data-nm-text-session', '');
    textSession = { key: key, el: el, original: original, originalText: sessionText(el), prior: prior, priorSpellcheck: priorSpellcheck };
    el.focus({ preventScroll: true });
    placeCaretEnd(el);
    return { key: key, text: sessionText(el) };
  }

  function restoreSessionAttrs(s) {
    if (s.prior === null) s.el.removeAttribute('contenteditable');
    else s.el.setAttribute('contenteditable', s.prior);
    if (s.priorSpellcheck === null) s.el.removeAttribute('spellcheck');
    else s.el.setAttribute('spellcheck', s.priorSpellcheck);
    s.el.removeAttribute('data-nm-text-session');
  }

  function endText(commit) {
    if (!textSession) return null;
    var s = textSession;
    var text = sessionText(s.el);
    var changed = text !== s.originalText;
    if (!commit) s.el.innerHTML = s.original;
    restoreSessionAttrs(s);
    textSession = null;
    return { key: s.key, text: text, changed: !!commit && changed, cancelled: !commit };
  }

  function activeText() {
    return textSession ? { key: textSession.key, text: sessionText(textSession.el) } : null;
  }

  function dispatchTextCommand(result, save) {
    window.dispatchEvent(new CustomEvent('nm-text-command', { detail: { result: result, save: !!save } }));
  }

  // Hit-test in frame coordinates, limited to the current slide; runtime-created nodes resolve upward.
  function hitLocal(x, y) {
    var cur = document.querySelector('.slide[data-nm-current]');
    var els = document.elementsFromPoint(x, y);
    // Decoration the deck itself marks as inert (pointer-events-none, aria-hidden) is hit-testable, but only as a
    // last resort: a click on a picture should select the picture, not the ornament drawn over it.
    function inert(el) {
      for (var n = el; n && n !== cur && n.nodeType === 1; n = n.parentElement) {
        if (n.matches && n.matches('.pointer-events-none,[aria-hidden="true"]')) return true;
      }
      return false;
    }
    var firstChoice = els.filter(function (el) { return !inert(el); });
    els = firstChoice.length && firstChoice.some(function (el) { return (!cur || cur.contains(el)) && el.closest('[data-nm-key]'); }) ? firstChoice : els;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (cur && !cur.contains(el)) continue;
      var t = el.closest('[data-nm-key]');
      if (t) {
        var smart = t.closest('svg[data-anatomy],svg[class*="anatomy"],svg[style*="--anatomy-"],iframe[data-anatomy],iframe[class*="anatomy"],iframe[src*="anatomy"]');
        if (smart && smart.hasAttribute('data-nm-key')) t = smart;
        return { key: t.getAttribute('data-nm-key'), tag: t.tagName.toLowerCase() };
      }
    }
    return null;
  }

  // --- preview patches --------------------------------------------------------------------------
  // The server answers an op with { key, outerHTML, attrsOnly }[] for elements whose source changed. attrsOnly:
  // copy the attributes onto the live element and keep its children (iframes and running state are untouched).
  // Otherwise the element is replaced. Returns the keys that could not be found or parsed: the caller reloads.
  // State the edit layer owns on slides (data-nm-current, active, visible) is kept.
  function syncAttributes(el, fresh) {
    var isSlide = el.classList.contains('slide');
    var current = el.hasAttribute('data-nm-current');
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name === 'data-nm-current') return;
      if (!fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
    });
    Array.prototype.forEach.call(fresh.attributes, function (a) {
      if (a.name === 'data-nm-current') return;
      if (el.getAttribute(a.name) === a.value) return;
      if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, a.name, a.value);
      else el.setAttribute(a.name, a.value);
    });
    if (isSlide) {
      el.classList.toggle('active', current);
      el.classList.toggle('visible', current);
    }
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MATH_NS = 'http://www.w3.org/1998/Math/MathML';
  // Parse an outerHTML string in the namespace of the live element it replaces: the HTML parser puts <text> or
  // <path> in the HTML namespace (nothing renders) and lowercases viewBox unless it is inside <svg> / <math>.
  function parseLike(el, html) {
    var holder = document.createElement('template');
    var wrap = null;
    if (el.namespaceURI === SVG_NS && el.localName !== 'svg') wrap = 'svg';
    else if (el.namespaceURI === MATH_NS && el.localName !== 'math') wrap = 'math';
    holder.innerHTML = wrap ? '<' + wrap + '>' + html + '</' + wrap + '>' : html;
    var root = holder.content.firstElementChild;
    return wrap && root ? root.firstElementChild : root;
  }
  function applyPatch(patches) {
    var missing = [];
    patches.forEach(function (p) {
      var el = document.querySelector('[data-nm-key="' + String(p.key).replace(/[^a-z0-9]/g, '') + '"]');
      var fresh = el ? parseLike(el, p.outerHTML) : null;
      if (!el || !fresh) {
        missing.push(p.key);
        return;
      }
      if (p.attrsOnly) syncAttributes(el, fresh);
      else el.replaceWith(fresh);
      if (p.attrsOnly && el.tagName === 'IFRAME') applyAnatomyOverrides(el, el.contentDocument);
    });
    return missing;
  }

  window.__nm = {
    applyPatch: applyPatch,
    goTo: goTo,
    freeze: freeze,
    isFrozen: function () {
      return frozen;
    },
    slides: slides,
    hitLocal: hitLocal,
    beginText: beginText,
    endText: endText,
    activeText: activeText,
    previewEntrance: previewEntrance,
    previewZoom: previewZoom,
    resetMotion: resetMotion,
    warnings: warnings,
    parkedCount: function () {
      return rootGate.parkedCount();
    },
    childFrames: function () {
      return childDocs.length;
    },
  };
  // Cookbook runtime contract. Old decks receive it in preview without source changes; a deck-owned method wins.
  var runtime = window.deck && typeof window.deck === 'object' ? window.deck : {};
  if (typeof runtime.goTo !== 'function') runtime.goTo = goTo;
  if (typeof runtime.setEditMode !== 'function') runtime.setEditMode = function (on) { freeze(!!on); };
  if (!runtime.runtimeVersion) runtime.runtimeVersion = 1;
  window.deck = runtime;
})();
`;
var EDIT_MODE_CSS = "/* Edit mode (from spike S2b). Active only under html[data-nm-edit]; removing the attribute returns the deck to itself. */\n\n/* Time stops: CSS animations pause, transitions are off (state changes land at once). */\nhtml[data-nm-edit] *,\nhtml[data-nm-edit] *::before,\nhtml[data-nm-edit] *::after {\n  animation-play-state: paused !important;\n  transition: none !important;\n}\n\n/* One slide: the one the editor chose, not the deck's own index. */\nhtml[data-nm-edit] .slide:not([data-nm-current]) {\n  visibility: hidden !important;\n  opacity: 0 !important;\n}\nhtml[data-nm-edit] .slide[data-nm-current] {\n  visibility: visible !important;\n  opacity: 1 !important;\n  z-index: 2 !important;\n}\n\n/* Entrance choreography at its final state (not !important, so an inline style still wins). */\nhtml[data-nm-edit] .slide[data-nm-current] .reveal {\n  opacity: 1;\n  transform: none;\n}\n\n/* Camera: no zoom transform, no dimming of the other cards. */\nhtml[data-nm-edit] .camera-rig {\n  transform: none !important;\n}\nhtml[data-nm-edit] .slide.is-camera-zoomed [data-zoom-step] {\n  opacity: 1 !important;\n  filter: none !important;\n}\nhtml[data-nm-edit] .slide[data-nm-motion-preview='zoom'] [data-zoom-step]:not(.zoom-focused) {\n  opacity: 0.22 !important;\n  filter: saturate(0.35) !important;\n}\nhtml[data-nm-edit] .slide[data-nm-motion-preview='zoom'] [data-zoom-step].zoom-focused {\n  opacity: 1 !important;\n  filter: none !important;\n  outline: 5px solid rgba(214, 63, 34, 0.72) !important;\n  outline-offset: 10px !important;\n}\n\n/* Everything in the current slide can be hit-tested, including decoration with pointer-events: none. */\nhtml[data-nm-edit] .slide[data-nm-current],\nhtml[data-nm-edit] .slide[data-nm-current] * {\n  pointer-events: auto !important;\n}\n\nhtml[data-nm-edit] [contenteditable='plaintext-only'][data-nm-text-session] {\n  white-space: pre-wrap !important;\n  caret-color: #d63f22 !important;\n  outline: 2px solid #d63f22 !important;\n  outline-offset: 4px !important;\n  cursor: text !important;\n  user-select: text !important;\n}\nhtml[data-nm-edit] [contenteditable='plaintext-only'][data-nm-text-session]::selection {\n  color: inherit;\n  background: rgba(214, 63, 34, 0.24);\n}\n\n/* S2b: the deck's own chrome (nav bar, edit toggle, edit badge, hotzones) is not part of a slide.\n   In the nevermind structure it is every body child outside .deck-viewport. Guarded with :has so a deck\n   without that wrapper is left alone instead of being blanked. */\nhtml[data-nm-edit] body:has(> .deck-viewport) > :not(.deck-viewport):not(script):not(style):not(link) {\n  display: none !important;\n}\n";
var SHELL = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="referrer" content="no-referrer">\n<meta name="color-scheme" content="light">\n<title>Nevermind Studio</title>\n<style id="nm-ui-css">:root{--m: #e6e2dc;--hi: #ffffff;--lo: rgba(163, 155, 143, .55);--lo2: rgba(163, 155, 143, .35);--ink: #27241f;--ink2: #57524a;--ink3: #5c564c;--verm: #d63f22;--verm-text: #b3311a;--fix-ink: #6d2a17;--cool: #4cc9f0;--leaf: #a8d98a;--warm: #ff8a4c;--raised: -6px -6px 14px var(--hi), 6px 6px 14px var(--lo);--raised-s: -3px -3px 7px var(--hi), 3px 3px 7px var(--lo);--pressed: inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi);--pressed-s: inset 3px 3px 7px var(--lo), inset -3px -3px 7px var(--hi);--tray: inset 2px 2px 5px var(--lo2), inset -2px -2px 5px var(--hi);--ui: "Thmanyah Sans", system-ui, -apple-system, "Segoe UI", sans-serif;--serif: "Thmanyah Serif Display", "Thmanyah Sans", serif;--num: "Zain Rounded", "Thmanyah Sans", system-ui, sans-serif;--ease: cubic-bezier(.22, 1, .36, 1);--fill-dir: left;color-scheme:light}:root[dir=ltr]{--fill-dir: right}*,*:before,*:after{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;overflow:hidden}body{background:var(--m);color:var(--ink);font-family:var(--ui);font-size:13px;line-height:1.4;-webkit-font-smoothing:antialiased}button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}ul{list-style:none}::selection{background:#d63f2233;color:var(--ink)}*{scrollbar-width:thin;scrollbar-color:rgba(163,155,143,.7) transparent}:focus-visible{outline:2px solid var(--ink);outline-offset:2px}button:focus:not(:focus-visible){outline:none}svg.i{inline-size:16px;block-size:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}.raised{background:var(--m);box-shadow:var(--raised)}.raised-s{background:var(--m);box-shadow:var(--raised-s)}.pressed{background:var(--m);box-shadow:var(--pressed)}.lbl{font-size:12px;color:var(--ink3)}.read{font-family:var(--num);font-variant-numeric:tabular-nums}button.raised-s:not(:disabled):not([aria-disabled=true]):hover{box-shadow:-2px -2px 5px var(--hi),2px 2px 5px var(--lo)}button.raised-s:not(:disabled):not([aria-disabled=true]):active{box-shadow:var(--pressed-s)}button{transition:box-shadow .16s var(--ease),color .16s var(--ease),opacity .16s var(--ease)}button:disabled,button[aria-disabled=true]{cursor:default}[data-tip]{position:relative}[data-tip]:focus-visible:after{content:attr(data-tip);position:absolute;inset-block-start:calc(100% + 10px);inset-inline-start:50%;translate:50% 0;z-index:20;inline-size:max-content;max-inline-size:240px;padding:6px 10px;border-radius:10px;background:var(--ink);color:#f4efe4;font-size:12px;font-weight:400;white-space:normal;pointer-events:none}:root[dir=ltr] [data-tip]:focus-visible:after{translate:-50% 0}.app{block-size:100vh;display:grid;grid-template-rows:72px minmax(0,1fr) 156px;grid-template-columns:352px minmax(0,1fr);grid-template-areas:"head head" "panel well" "fihris fihris";column-gap:6px;padding:0 14px 14px}.app.fihris-compact{grid-template-rows:72px minmax(0,1fr) 58px}@media(max-width:1366px){.app{grid-template-columns:320px minmax(0,1fr)}}.masthead{grid-area:head;display:flex;align-items:center;gap:14px;padding-inline:8px;min-inline-size:0}.mark{display:flex;align-items:center;gap:10px;min-inline-size:0}.logo{inline-size:34px;block-size:34px;border-radius:50%;display:grid;place-items:center;flex:none}.logo i{inline-size:12px;block-size:12px;border-radius:50%;background:conic-gradient(from 200deg,var(--cool),var(--leaf),var(--warm),var(--cool))}.mark-text{min-inline-size:0}.wordmark{display:block;font-family:var(--serif);font-weight:900;font-size:21px;line-height:1.2}.mark-sub{display:block;font-size:12px;color:var(--ink3);margin-block-start:-2px;max-inline-size:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tray{display:flex;gap:6px;padding:5px;border-radius:14px;background:var(--m);box-shadow:var(--tray)}.masthead .tray{margin-inline-start:18px;flex:none}.masthead .tray button{block-size:36px;padding-inline:14px;border-radius:10px;display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2)}.masthead .tray button.on{box-shadow:var(--pressed-s);color:var(--ink);font-weight:700}.masthead .tray button[aria-disabled=true]{color:var(--ink3);opacity:.6;cursor:not-allowed}.sp{flex:1}.pill{block-size:40px;border-radius:20px;display:flex;align-items:center;gap:9px;padding-inline:16px;font-size:12px;color:var(--ink3);flex:none;white-space:nowrap}.pill .dot{inline-size:8px;block-size:8px;border-radius:50%;background:var(--leaf);box-shadow:inset 1px 1px 2px #0000001f}.pill.is-dirty .dot{background:var(--warm)}.pill.is-dirty{color:var(--ink2)}.pill-n{font-size:20px;color:var(--ink);line-height:1;display:inline-block}.pill-n.tick{animation:nm-tick .22s var(--ease)}@keyframes nm-tick{0%{transform:translateY(45%);opacity:.2}to{transform:none;opacity:1}}.round{inline-size:40px;block-size:40px;border-radius:50%;display:grid;place-items:center;color:var(--ink2);font-size:12px;font-weight:700;flex:none}.round:disabled{color:var(--ink3);opacity:.45;box-shadow:-2px -2px 5px var(--hi),2px 2px 5px var(--lo2)}.round.is-on{color:var(--verm-text)}.round.lang{font-family:var(--ui);font-size:13px}.save{block-size:40px;padding-inline:22px;border-radius:20px;color:var(--verm-text);font-weight:700;font-size:14px;flex:none}.save[aria-disabled=true]{color:var(--ink3)}.well{grid-area:well;border-radius:28px;position:relative;overflow:hidden;margin:6px 0 10px;min-inline-size:0;min-block-size:0}.scroller{position:absolute;inset:0;overflow:auto;border-radius:28px}.stage-pad{min-inline-size:100%;min-block-size:100%;inline-size:max-content;display:grid;place-items:center}.stage{position:relative;border-radius:6px;background:#fff;box-shadow:0 2px 4px #3c321e14,0 18px 36px #3c321e29}.stage .clip{position:absolute;inset:0;overflow:hidden;border-radius:6px}.stage iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0;background:#fff}.hit{position:absolute;inset:0;z-index:2;cursor:default}.hit.is-playing,.hit.is-editing{pointer-events:none}.overlays{position:absolute;inset:0;z-index:3;pointer-events:none}.ov-hover{position:absolute;outline:1px dashed var(--verm);outline-offset:1px;border-radius:2px}.ov-sel{position:absolute;border:1px solid color-mix(in srgb,var(--verm) 62%,transparent);border-radius:2px;margin:-1.5px 0 0 -1.5px;box-sizing:content-box;pointer-events:none;cursor:move;touch-action:none;user-select:none}.ov-sel.is-primary{border-width:1.5px;border-color:var(--verm)}.ov-tag{position:absolute;inset-block-start:-26px;background:var(--verm);color:#fff;font-size:12px;line-height:1.5;padding:2px 9px;white-space:nowrap}.ov-tag.at-right{right:-2px;border-radius:8px 8px 0}.ov-tag.at-left{left:-2px;border-radius:8px 8px 8px 0}.ov-sel .h{position:absolute;inline-size:9px;block-size:9px;border-radius:50%;background:#fff;border:1.5px solid var(--verm);touch-action:none;pointer-events:auto}.ov-sel .h-nw{top:-5px;left:-5px;cursor:nwse-resize}.ov-sel .h-n{top:-5px;left:calc(50% - 5px);cursor:ns-resize}.ov-sel .h-ne{top:-5px;right:-5px;cursor:nesw-resize}.ov-sel .h-e{top:calc(50% - 5px);right:-5px;cursor:ew-resize}.ov-sel .h-se{bottom:-5px;right:-5px;cursor:nwse-resize}.ov-sel .h-s{bottom:-5px;left:calc(50% - 5px);cursor:ns-resize}.ov-sel .h-sw{bottom:-5px;left:-5px;cursor:nesw-resize}.ov-sel .h-w{top:calc(50% - 5px);left:-5px;cursor:ew-resize}.drag-marks{position:absolute;inset:0;pointer-events:none}.drag-marks .guide{position:absolute;display:block;background:#2684ff;box-shadow:0 0 0 1px #fffc}.drag-marks .guide.x{width:1px}.drag-marks .guide.y{height:1px}.drag-marks[data-equal] .guide{background:var(--verm)}.drag-marks .distance{position:absolute;translate:-50% -50%;padding:2px 6px;border-radius:8px;background:var(--ink);color:#fff;font:11px/1.4 var(--num);white-space:nowrap}.zoomw{position:absolute;inset-block-end:14px;inset-inline-start:18px;display:flex;align-items:baseline;gap:10px;font-size:12px;color:var(--ink3);padding:4px 10px;border-radius:12px;background:var(--m);z-index:4}.zoomw .read{font-size:18px;color:var(--ink)}.panel{grid-area:panel;border-radius:28px;margin:6px 0 10px;padding:18px;display:flex;flex-direction:column;gap:14px;min-block-size:0;overflow:hidden}.tabs button{flex:1;block-size:32px;border-radius:10px;font-size:13px;color:var(--ink2)}.tabs button.on{box-shadow:var(--pressed-s);color:var(--ink);font-weight:700}.tab-count{color:var(--verm-text);font-family:var(--num);font-weight:700;margin-inline-start:4px}.tabpanel{flex:1;min-block-size:0;overflow-y:auto;overflow-x:hidden;padding:8px;margin:-8px}.props{display:flex;flex-direction:column;gap:16px}.crumbs{display:flex;flex-wrap:wrap;gap:2px 6px;font-size:12px;color:var(--ink3)}.crumb{display:inline-flex;align-items:center;gap:6px}.crumb+.crumb:before{content:"\\2039";color:var(--ink3)}:root[dir=ltr] .crumb+.crumb:before{content:"\\203a"}.crumb button{color:var(--ink2);border-radius:6px;padding-inline:2px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px}.crumb button:hover{text-decoration-color:currentColor}.crumb [aria-current]{color:var(--ink);font-weight:700}.el .t{font-family:var(--serif);font-weight:900;font-size:22px;line-height:1.2;margin-block-start:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.props.empty .el .t{font-size:20px}.hint{font-size:13px;color:var(--ink2);line-height:1.7}.hint.agent{padding:14px 4px}.dialrow{display:grid;grid-template-columns:168px minmax(0,1fr);gap:14px;align-items:center}.dial{inline-size:168px;block-size:168px;border-radius:50%;position:relative;display:grid;place-items:center}.dial svg{position:absolute;inset:0}.dial-track,.dial-arc{fill:none;stroke-width:5;stroke-linecap:round}.dial-track{stroke:#a39b8f40}.dial-arc{stroke:url(#nm-dial-g)}.dial-marker{fill:#fff;stroke:var(--verm);stroke-width:2}.knob{inline-size:104px;block-size:104px;border-radius:50%;display:grid;place-items:center;text-align:center;position:relative;background:repeating-conic-gradient(from 0deg,rgba(163,155,143,.18) 0 2deg,transparent 2deg 6deg),var(--m)}.knob .read{display:block;font-size:36px;line-height:.95;font-weight:700;color:var(--ink)}.knob .read.long{font-size:28px}.knob small{display:block;font-size:12px;color:var(--ink3);margin-block-start:2px}.side{display:flex;flex-direction:column;gap:10px;min-inline-size:0}.side .lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wt{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.wt button{block-size:32px;border-radius:10px;font-size:12.5px;color:var(--ink2);display:grid;place-items:center}.wt button.on{box-shadow:var(--pressed-s);color:var(--ink);font-weight:700}.font-select{display:flex;flex-direction:column;gap:5px}.font-select select{inline-size:100%;min-inline-size:0;block-size:34px;border:0;border-radius:10px;padding-inline:10px 28px;color:var(--ink);background:var(--m);box-shadow:var(--pressed-s);font:inherit}.colours .lbl{margin-block-end:8px}.sw{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}.sw button{inline-size:34px;block-size:34px;border-radius:50%;display:grid;place-items:center}.sw button i{inline-size:20px;block-size:20px;border-radius:50%;display:block;box-shadow:inset 0 0 0 1px #27241f1f}.sw button.on{box-shadow:var(--pressed-s)}.sw button.on i{box-shadow:inset 0 0 0 1px #27241f1f,0 0 0 2px var(--m),0 0 0 3.5px var(--verm)}.sl{display:flex;flex-direction:column;gap:8px}.sl .h{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:var(--ink3)}.sl .h .read{font-size:16px;color:var(--ink)}.track{block-size:10px;border-radius:5px;position:relative}.track input[type=range]{position:absolute;inset:-9px 0;inline-size:100%;opacity:0;cursor:pointer}.fill{position:absolute;inset-block:2px;inset-inline-start:2px;border-radius:4px;min-inline-size:0;background:linear-gradient(to var(--fill-dir),var(--cool),var(--leaf) 60%,var(--warm))}.thumb.raised-s{position:absolute;inset-block-start:-8px;inline-size:26px;block-size:26px;border-radius:50%;display:grid;place-items:center}.thumb.raised-s i{inline-size:8px;block-size:8px;border-radius:50%;box-shadow:inset 1px 1px 2px var(--lo),inset -1px -1px 2px var(--hi)}.pos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pos .cell{block-size:56px;border-radius:16px;padding:8px 12px;display:flex;flex-direction:column;justify-content:space-between}.pos .cell.wide{grid-column:span 2}.pos small{font-size:12px;color:var(--ink3)}.pos .read{font-size:18px;color:var(--ink);line-height:1}.pos input.read{inline-size:100%;min-inline-size:0;border:0;padding:0;background:transparent;font-family:var(--num)}.pos .flow{font-size:13px;color:var(--ink2)}.free-position{margin-inline-start:auto;color:var(--verm-text);font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:3px}.full-props,.image-props{border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}.prop-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.prop-grid label{display:flex;flex-direction:column;gap:4px;color:var(--ink3);font-size:11px}.prop-grid input,.prop-grid select{min-inline-size:0;inline-size:100%;block-size:34px;border:0;border-radius:10px;padding-inline:9px;color:var(--ink);background:var(--m);box-shadow:var(--pressed-s);font:13px var(--num)}.segmented{display:flex;gap:4px;padding:4px;border-radius:12px}.segmented button{flex:1;block-size:32px;border-radius:9px;color:var(--ink2);font-size:12px}.upload{position:relative;overflow:hidden;min-block-size:38px;border-radius:12px;display:grid;place-items:center;color:var(--verm-text);font-size:12px;font-weight:700;cursor:pointer}.upload input{position:absolute;inline-size:1px;block-size:1px;opacity:0}.tg{display:grid;grid-template-columns:1fr;gap:10px}.tg div{min-block-size:60px;border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between;gap:4px;font-size:13px}.tg div span{display:flex;align-items:center;gap:6px}.tg div small{font-size:12px;color:var(--ink3)}.tg div.on{box-shadow:var(--pressed-s);outline:1.5px solid rgba(214,63,34,.55);outline-offset:-3px}.tg div.on svg{color:var(--verm-text)}.fix{border-radius:16px;padding:12px 14px;font-size:12.5px;line-height:1.6;color:var(--fix-ink);display:flex;gap:10px;align-items:flex-start}.fix svg{color:var(--verm-text);margin-block-start:3px}.fix li+li{margin-block-start:6px}.layers{display:flex;flex-direction:column;gap:2px}.layer-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px}.layers button{inline-size:100%;min-block-size:32px;border-radius:10px;display:flex;align-items:center;gap:8px;text-align:start;font-size:13px;padding-inline-end:10px}.layers button:hover{background:#fff6}.layers button.on{box-shadow:var(--pressed-s);color:var(--verm-text);font-weight:700}.layers .role{flex:none;color:var(--ink)}.layers button.on .role{color:var(--verm-text)}.layers .snip{color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}.layer-actions{display:flex;opacity:0;transition:opacity .12s ease}.layer-row:hover .layer-actions,.layer-row:focus-within .layer-actions{opacity:1}.layer-actions button{inline-size:28px;min-block-size:28px;padding:5px;color:var(--ink3)}.agent-notes{display:flex;flex-direction:column;gap:12px}.ai-request{display:flex;flex-direction:column;gap:10px}.ai-request h2{font-family:var(--serif);font-size:20px;line-height:1.25;text-wrap:balance}.ai-kind{inline-size:100%}.ai-kind button{flex:1;min-block-size:34px;border-radius:10px;color:var(--ink2)}.ai-kind button.on{box-shadow:var(--pressed-s);color:var(--ink);font-weight:700}.ai-compose{display:grid;gap:6px}.ai-compose textarea{inline-size:100%;min-block-size:78px;resize:vertical;border:0;border-radius:10px;padding:10px 12px;background:var(--m);box-shadow:var(--pressed-s);color:var(--ink);font:inherit;line-height:1.6;caret-color:var(--verm-text)}.ai-compose textarea::placeholder{color:var(--ink3);opacity:1}.ai-compose textarea:disabled{opacity:.58;cursor:not-allowed}.ai-submit{min-block-size:38px;border-radius:19px;padding-inline:16px;color:var(--verm-text);font-weight:700}.ai-submit:disabled{color:var(--ink3);opacity:.55}.ai-status{color:var(--ink2);font-size:12px;line-height:1.55}.ai-status.failed{color:var(--fix-ink)}.ai-status.accepted{color:var(--verm-text);font-weight:700}.ai-review{display:grid;gap:9px}.ai-review-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.ai-review-head h3{min-inline-size:0;font-size:13px;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ai-review-head span{flex:none;color:var(--ink3);font-size:11px}.ai-review pre{max-block-size:230px;overflow:auto;border-radius:10px;padding:10px;color:var(--ink);font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;text-align:start}.ai-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px}.ai-actions button{min-block-size:36px;border-radius:18px;padding-inline:12px}.ai-actions .accept{color:var(--verm-text);font-weight:700}.agent-divider{block-size:1px;background:#57524a33;margin-block:4px 2px}.note-target{inline-size:100%}.note-target button{flex:1;block-size:34px;border-radius:10px;color:var(--ink2)}.note-target button.on{box-shadow:var(--pressed-s);color:var(--ink);font-weight:700}.note-target-help{min-block-size:20px;font-size:12px;line-height:1.55;color:var(--ink3)}.note-target-help.ready{color:var(--ink2);font-weight:700}.note-compose{display:flex;flex-direction:column;gap:6px}.note-compose textarea{inline-size:100%;min-block-size:88px;resize:vertical;border:0;border-radius:10px;padding:10px 12px;background:var(--m);box-shadow:var(--pressed-s);color:var(--ink);font:inherit;line-height:1.6}.note-compose textarea::placeholder{color:var(--ink3);opacity:1}.note-add{block-size:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--verm-text);font-weight:700}.note-add:disabled{color:var(--ink3);opacity:.55}.note-list{margin-block-start:2px}.note-list h3{font-size:12px;color:var(--ink3);font-weight:700;margin-block-end:4px}.note-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding-block:10px;border-block-start:1px solid rgba(87,82,74,.2)}.note-jump{min-inline-size:0;text-align:start;display:flex;flex-direction:column;gap:4px;border-radius:8px;padding:2px}.note-jump span{line-height:1.55;text-wrap:pretty}.note-jump small{color:var(--ink3);font-size:11.5px}.note-jump:hover span{color:var(--verm-text)}.note-done{block-size:32px;padding-inline:12px;border-radius:16px;color:var(--ink2);font-size:12px}.phase7-panel{display:flex;flex-direction:column;gap:14px}.phase7-panel h2{font-family:var(--serif);font-size:22px;line-height:1.2}.phase7-panel fieldset{border:0;border-block-start:1px solid rgba(87,82,74,.18);padding-block-start:12px;display:grid;gap:9px}.phase7-panel legend{color:var(--ink);font-weight:700;padding-inline-end:8px}.phase7-panel label{display:grid;gap:5px;color:var(--ink3);font-size:12px}.phase7-panel input,.phase7-panel select{inline-size:100%;min-inline-size:0;block-size:34px;border:0;border-radius:10px;padding-inline:9px;color:var(--ink);background:var(--m);box-shadow:var(--pressed-s);font:13px var(--ui)}.phase7-panel input[type=color]{padding:4px;cursor:pointer}.phase7-panel>fieldset>button,.phase7-panel fieldset>button{min-block-size:36px;border-radius:12px;padding-inline:12px;color:var(--verm-text);font-weight:700}.phase7-panel button:disabled{opacity:.45;cursor:not-allowed}.motion-list{display:grid;gap:7px;counter-reset:motion-step}.motion-list li{display:grid;grid-template-columns:minmax(0,1fr) 30px 30px auto;gap:5px;align-items:center;counter-increment:motion-step}.motion-list li:before{content:counter(motion-step);grid-column:1 / -1;color:var(--ink3);font:11px var(--num)}.motion-list button{min-block-size:30px;border-radius:9px;box-shadow:var(--raised-s);color:var(--ink2);padding-inline:6px}.identity-colours{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.identity-colours label{padding:8px;border-radius:12px;box-shadow:var(--raised-s)}.note-marks{position:absolute;inset:0;z-index:4;pointer-events:none}.note-area-mark,.note-area-draft{position:absolute;border-radius:4px;outline:1.5px dashed var(--verm);outline-offset:-1px;background:#d63f2214}.note-area-mark{pointer-events:auto;cursor:pointer}.note-area-mark:hover{background:#d63f2221}.note-area-draft{z-index:1}.note-pin{position:absolute;translate:-50% -100%;inline-size:28px;block-size:28px;border-radius:50%;display:grid;place-items:center;background:var(--verm);color:#fff;box-shadow:0 2px 6px #531c1147;pointer-events:auto}.note-pin svg{inline-size:16px;block-size:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.hit.is-targeting{cursor:crosshair}.fihris{grid-area:fihris;position:relative;border-radius:28px;display:flex;gap:14px;padding:14px 18px;align-items:center;min-inline-size:0}.tiles{flex:1;min-inline-size:0;display:flex;gap:14px;overflow-x:auto;overflow-y:hidden;padding:8px;margin:-8px;scroll-padding-inline:8px}.tile{inline-size:188px;flex:none;border-radius:16px;padding:8px 8px 7px;display:flex;flex-direction:column;gap:6px;text-align:start}.tile .thumb{position:relative;display:block;inline-size:172px;block-size:96.75px;border-radius:6px;overflow:hidden;background:#f3f0ea;box-shadow:inset 0 0 0 1px #27241f0f}.tile .thumb iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0;pointer-events:none;opacity:0;transition:opacity .2s var(--ease);background:#fff}.tile .thumb.ready iframe{opacity:1}.tile .cap{display:flex;gap:7px;align-items:baseline;padding-inline:3px;min-inline-size:0}.tile .n{font-family:var(--serif);font-weight:700;font-size:15px;color:var(--ink3);flex:none;font-variant-numeric:tabular-nums}.tile .tt{font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tile.cur{box-shadow:var(--pressed)}.tile.cur .n{color:var(--verm-text)}.tile.cur .tt{color:var(--ink);font-weight:700}.add{inline-size:64px;block-size:64px;border-radius:50%;flex:none;display:grid;place-items:center;color:var(--ink3)}.add[aria-disabled=true]{opacity:.55;cursor:not-allowed}.fold{inline-size:32px;block-size:32px;border-radius:50%;flex:none;display:grid;place-items:center;color:var(--ink2)}.slide-actions{display:flex;flex-direction:column;gap:3px}.slide-actions button{inline-size:28px;block-size:24px;border-radius:8px;display:grid;place-items:center;color:var(--ink3);font:11px var(--num)}.slide-actions button:hover{box-shadow:var(--pressed-s);color:var(--ink)}.layout-picker{position:absolute;inset-inline-end:72px;inset-block-end:calc(100% + 10px);z-index:20;inline-size:min(620px,78vw);max-block-size:55vh;overflow:hidden;border-radius:20px;padding:14px;background:var(--m)}.layout-picker-head{display:flex;align-items:center;justify-content:space-between;margin-block-end:10px}.layout-picker-head button{inline-size:30px;block-size:30px;border-radius:50%;padding:6px}.layout-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;max-block-size:43vh;overflow-y:auto}.layout-list button{min-block-size:54px;border-radius:12px;padding:8px 10px;box-shadow:var(--raised-s);display:flex;flex-direction:column;align-items:flex-start;text-align:start}.layout-list small{color:var(--ink3);font-size:10px;text-transform:uppercase}.layout-list span{color:var(--ink);font-size:12px;font-weight:700}.fihris.compact{padding:6px 14px;border-radius:22px;gap:10px}.fihris.compact .tiles{gap:8px;padding:6px;margin:-6px}.fihris.compact .tile{inline-size:auto;max-inline-size:200px;flex-direction:row;padding:6px 12px;border-radius:12px}.fihris.compact .tile .tt{max-inline-size:150px}.fihris.compact .add{inline-size:34px;block-size:34px}.banners{grid-area:well;align-self:start;justify-self:center;z-index:10;margin-block-start:20px;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-inline-size:min(680px,92%)}.banner{pointer-events:auto;border-radius:18px;padding:12px 14px 12px 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:var(--ink)}.banner>svg{color:var(--verm-text)}.banner .msg{display:flex;flex-direction:column;gap:2px;flex:1;min-inline-size:0}.banner .msg span{color:var(--ink2)}.banner .acts{display:flex;gap:8px;flex:none}.banner .acts button:not(.round){block-size:34px;padding-inline:14px;border-radius:17px;font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap}.banner .acts button:disabled{opacity:.45}.banner .round{inline-size:34px;block-size:34px}.banner.conflict{outline:1.5px solid rgba(214,63,34,.55);outline-offset:-4px}.banner.quiet{color:var(--ink2)}.toast-slot{grid-area:well;align-self:end;justify-self:center;z-index:10;margin-block-end:26px;pointer-events:none}.toast{border-radius:16px;padding:8px 16px;font-size:13px;color:var(--ink);animation:nm-rise .2s var(--ease)}@keyframes nm-rise{0%{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:1ms!important;transition-duration:1ms!important}}.export-dialog{margin:auto;inset:0;border:0;border-radius:28px;padding:24px 26px;inline-size:min(560px,92vw);max-block-size:90vh;overflow:auto;color:var(--ink);font-family:var(--ui)}.export-dialog::backdrop{background:#27241f6b}.export-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.export-head h2{margin:0;font-family:var(--serif);font-size:22px}.export-intro{margin:10px 0 14px;color:var(--ink2);font-size:13px;line-height:1.6}.export-formats{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.export-formats legend{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)}.export-format{display:grid;grid-template-columns:auto 1fr;column-gap:12px;row-gap:2px;align-items:center;padding:10px 14px;border-radius:14px;cursor:pointer;box-shadow:var(--raised-s)}.export-format.on{box-shadow:var(--pressed-s)}.export-format.on .name{color:var(--verm-text)}.export-format input{grid-row:span 2;inline-size:18px;block-size:18px;accent-color:#d63f22;margin:0}.export-format:focus-within{outline:2px solid var(--ink);outline-offset:2px}.export-format .name{font-weight:700;font-size:14px;display:flex;gap:8px;align-items:center}.export-format .hint{color:var(--ink2);font-size:12px}.export-format .chip{font-style:normal;font-size:11px;font-weight:700;padding:1px 8px;border-radius:10px;color:var(--verm-text);box-shadow:var(--pressed-s)}.export-check{display:flex;gap:10px;align-items:center;margin-block:14px 4px;font-size:13px;color:var(--ink2)}.export-check input{inline-size:18px;block-size:18px;accent-color:#d63f22}.export-status{min-block-size:24px;margin-block:10px;font-size:13px;color:var(--ink2)}.export-status .bad{color:var(--verm-text);font-weight:700}.export-warn{border-radius:14px;padding:10px 14px;box-shadow:var(--pressed-s);margin-block-end:12px}.export-warn h3{margin:0 0 6px;font-size:13px}.export-warn ul{margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--ink2);line-height:1.55;max-block-size:160px;overflow:auto}.export-actions{display:flex;gap:10px;justify-content:flex-end;align-items:center}.export-run,.export-download{block-size:40px;padding-inline:22px;border-radius:20px;font-weight:700;font-size:14px;color:var(--verm-text);display:inline-flex;align-items:center;text-decoration:none}.export-download{color:var(--ink)}.export-run:disabled{color:var(--ink3);opacity:.6}.export-warn .path{font-family:var(--num);font-size:11px;color:var(--ink)}\n</style>\n</head>\n<body>\n<div id="app"></div>\n<script id="nm-ui-js">"use strict";(()=>{var Ni=Object.defineProperty;var ua=(e,t,n)=>t in e?Ni(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var da=(e,t)=>{for(var n in t)Ni(e,n,{get:t[n],enumerable:!0})};var bt=(e,t,n)=>ua(e,typeof t!="symbol"?t+"":t,n);var O,ki,Bn,Me,Mn,Jt,Ri,jt,Li,Fn,wn,pa,At=Symbol.for("pv"),Zt={},en=[],ha=/^m(i|n|o|s|text|space)$/,Hn=Array.isArray,Un=en.slice,Ge=Object.assign;function Ke(e){e&&e.parentNode&&e.remove()}function Di(e,t,n){var i,a,s,o={},c=arguments.length;for(s in t)s=="key"?i=t[s]:s=="ref"&&typeof e!="function"?a=t[s]:o[s]=t[s];return c>2&&(o.children=c>3?Un.call(arguments,2):n),xt(e,o,i,a,null)}function xt(e,t,n,i,a){var s={type:e,props:t,key:n,ref:i,__k:null,__:null,__b:0,__e:null,__c:null,constructor:At,__v:a||++ki,__i:-1,__u:0};return!a&&O.vnode&&O.vnode(s),s}function $(e){return e.children}function st(e,t){this.props=e,this.context=t,this.__g=0}function we(e,t){if(t==null)return e.__&&we(e.__,e.__i+1);for(var n;t<e.__k.length;t++)if((n=e.__k[t])&&n.__e)return n.__e;return typeof e.type!="function"||e.props.__P?null:we(e)}function ma(e){var t,n=e.__v,i=n.__e,a=[],s=[],o=e.__P;o&&((t=Ge({constructor:At},n)).__v=n.__v+1,O.vnode&&O.vnode(t),zn(o,t,n,e.__n,o.namespaceURI,32&n.__u?[i]:null,a,i||we(n),32&n.__u,s),t.__v=n.__v,t.__.__k[t.__i]=t,Hi(a,t,s),n.__=n.__e=null,t.__e!=i&&Pi(t))}function Pi(e){if((e=e.__)&&e.__c&&!e.props.__P)return e.__e=null,e.__k.some(function(t){return t&&(e.__e=t.__e)}),Pi(e)}function Ii(e){(8&e.__g||(e.__g|=8,Me.push(e),Jt++))&&Mn==O.debounceRendering||((Mn=O.debounceRendering)||queueMicrotask)(Mi)}function Mi(){try{for(var e,t=1;Me.length;)Me.length>t&&Me.sort(Ri),e=Me.shift(),t=Me.length,8&e.__g&&ma(e)}finally{(Jt=Me.length)&&(Mn||queueMicrotask)(Mi)}}function wi(e,t,n,i,a,s,o,c,d,m,u){var y,v,h,T,f,E,b=i.__k||en,_=t.length;for(d=fa(n,t,b,d,_),y=0;y<_;y++)(h=n.__k[y])!=null&&(v=~h.__i&&b[h.__i]||Zt,h.__i=y,E=zn(e,h,v,a,s,o,c,d,m,u),T=h.__e,(v.ref!=h.ref||8&v.__u)&&(v.ref&&Yn(v.ref,null,h,v),h.ref&&u.push(h.ref,h.__c||T,h)),f=f||T,4&h.__u?(d=Bi(h,d,e,!v.__v),v.__e&&(v.__e=null)):typeof h.type=="function"&&E!==void 0?d=E:T&&(d=T.nextSibling),h.__u&=-21);return n.__e=f,d}function fa(e,t,n,i,a){var s,o,c,d,m,u,y,v,h,T=n.length,f=T,E=0,b=0,_=e.__k=Array(a);for(s=0;s<a;s++)(o=t[s])!=null&&typeof o!="boolean"&&typeof o!="function"?(typeof o!="object"||o.constructor===String?o=_[s]=xt(null,o):Hn(o)?o=_[s]=xt($,{children:o}):o.constructor===At&&o.__b?o=_[s]=xt(o.type,o.props,o.key,o.ref,o.__v):_[s]=o,d=s+E,o.__=e,o.__b=e.__b+1,c=null,~(m=o.__i=Ea(o,n,d,f))&&(f--,(c=n[m])&&(c.__u|=2)),c&&c.__v?(o.__u|=16,m==d-1?E--:m==d+1?E++:m!=d&&(m>d?E--:E++,b=1)):(~m||(a>T?E--:a<T&&E++),typeof o.type!="function"&&(o.__u|=4))):_[s]=null;if(b){for(u=[],y=[],s=0;s<a;s++)if((o=_[s])&&16&o.__u){for(E=0,v=u.length;E<v;)u[h=E+v>>1]<o.__i?E=h+1:v=h;u[E]=o.__i,y[s]=E+1}for(E=u.length;s--;)y[s]&&(y[s]==E?E--:_[s].__u|=4)}if(f)for(s=0;s<T;s++)!(c=n[s])||2&c.__u||(c.__e==i&&(i=we(c)),$n(c,c));return i}function Bi(e,t,n,i){var a,s,o,c;if(typeof e.type=="function"){if(e.props.__P)return t;if(a=e.__k)for(s=0;s<a.length;s++)a[s]&&(a[s].__=e,t=Bi(a[s],t,n,!1));return t}for(t&&!t.parentNode&&(t=we(e))&&!t.parentNode&&(t=null),o=e.__e,c=t;c&&c.nodeType==8;)c=c.nextSibling;for(o!=c&&(!i&&n.moveBefore&&o.parentNode?n.moveBefore(o,t):n.insertBefore(o,t||null)),t=o;(t=t&&t.nextSibling)&&t.nodeType==8&&!t.data.startsWith("$s"););return t}function Ea(e,t,n,i){var a,s=e.key,o=e.type,c=t[n],d=c&&!(2&c.__u);if(c===null&&s==null||d&&s==c.key&&o==c.type)return n;if(i>(d?1:0)){for(a=n-1;a>=0;a--)if((c=t[a])&&!(2&c.__u)&&s==c.key&&o==c.type)return a;for(a=n+1;a<t.length;a++)if((c=t[a])&&!(2&c.__u)&&s==c.key&&o==c.type)return a}return-1}function Oi(e,t,n){n==null&&(n=""),t[0]=="-"?e.setProperty(t,n):e[t]=n}function Vt(e,t,n,i,a){var s,o;if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof i=="string"&&(e.style.cssText=i=""),i)for(t in i)n&&t in n||Oi(e.style,t);if(n)for(t in n)i&&n[t]==i[t]||Oi(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")typeof n!="function"&&(n=null),typeof i!="function"&&(i=null),(e.__e||(e.__e={}))[t]=n,n&&i||(o=wn[t]||(wn[t]=Ta(t)),(e.__a||(e.__a={}))[t]=Fn,s=t!=(t=t.replace(Li,"$1")),(t=t.slice(2))[0]<"a"&&(t=t.toLowerCase()),n?e.addEventListener(t,o,s):e.removeEventListener(t,o,s));else{if(a=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{return void(e[t]=n??"")}catch{}if(typeof n=="function")return;n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n)}}function Ta(e){return function(t){var n=this.__e;if(n){if(n=n[e],t[jt]==null)t[jt]=Fn++;else if(t[jt]<this.__a[e])return;return n(O.event?O.event(t):t)}}}function zn(e,t,n,i,a,s,o,c,d,m){var u,y,v,h,T,f,E,b,_,x,C,M,Y,he,X,A,S,F,Q=t.type;if(t.constructor!==At)return null;128&n.__u&&(d=32&n.__u,u=n.__c.__z)&&(t.__u|=d,y=s=[],u.nodeType==8?c=qt(u,s):s.push(u),c=s[0]||c),(u=O.__b)&&u(t);e:if(typeof Q=="function"){v=o.length;try{if(b=t.props,_=(u=Q.prototype)&&u.render,x=(u=Q.contextType)&&i[u.__c],C=u?x?x.props.value:u.__:i,(h=n.__c)?(t.__c=h,2&h.__g&&(h.__g|=1)):(_?t.__c=h=new Q(b,C):(t.__c=h=new st(b,C),h.constructor=Q,h.render=_a),x&&x.sub(h),h.state||(h.state={}),h.__n=i,h.__g|=8,h.__h=[],h.__k=[]),_&&(h.__s||(h.__s=h.state),Q.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=Ge({},h.__s)),Ge(h.__s,Q.getDerivedStateFromProps(b,h.__s)))),T=h.props,f=h.state,h.__v=t,n.__c){if(b!==T&&_&&!Q.getDerivedStateFromProps&&h.componentWillReceiveProps&&h.componentWillReceiveProps(b,C),t.__v==n.__v&&!(8&h.__g)||!(4&h.__g)&&h.shouldComponentUpdate&&h.shouldComponentUpdate(b,h.__s,C)===!1){t.__v!=n.__v&&(h.props=b,h.state=h.__s,h.__g&=-9),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(J){J&&(J.__=t)}),en.push.apply(h.__h,h.__k),h.__k=[],h.__h.length&&o.push(h),c=we(n);break e}h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,C),_&&h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(T,f,E)})}else _&&!Q.getDerivedStateFromProps&&h.componentWillMount&&h.componentWillMount(),_&&h.componentDidMount&&h.__h.push(h.componentDidMount);h.context=C,h.props=b,h.__P=e,h.__g&=-5,M=O.__r,Y=_?25:0;do h.__g&=-9,M&&M(t),u=h.render(h.props,h.state=h.__s,h.context);while(8&h.__g&&++Y<25);_&&(en.push.apply(h.__h,h.__k),h.__k=[]),h.state=h.__s,h.getChildContext&&(i=Ge({},i,h.getChildContext())),_&&n.__c&&h.getSnapshotBeforeUpdate&&(E=h.getSnapshotBeforeUpdate(T,f)),he=u&&u.type===$&&u.key==null?u.props.children:u,b.__P&&(u=c,a=(e=b.__P).namespaceURI,d=s=null,n.props&&n.props.__P!=e&&(n.__k.some(function(J){J&&$n(J,J)}),n.__k=null),c=n.__k?we(n,0):null),c=wi(e,Hn(he)?he:[he],t,n,i,a,s,o,c,d,m),b.__P&&(t.__e=null,c=u),t.__u&=-161,y&&y.some(Ke),h.__h.length&&o.push(h),1&h.__g&&(h.__g&=-4)}catch(J){if(o.length=v,t.__v=null,d||s)if(J&&J.then){if(t.__u|=128|d,s){for(~(S=s.indexOf(c||void 0))||(S=s.length);(F=s[S-1])&&F.nodeType==8;)S--;for(;S<s.length;S++)if(F=s[S])if(s[S]=null,X){if(F==A)break}else{if(F.nodeType!=8)break;F.data.startsWith("$s")&&(A=qt(X=F))}}if(!X){for(;c&&c.nodeType==8&&c.nextSibling;)c=c.nextSibling;X=c}(u=qt(X=t.__c.__z||(t.__c.__z=X)))?(t.__e=X,c=u):t.__e=c,c=c&&c.nextSibling}else s&&s.some(Ke);else t.__e=n.__e;t.__k||(t.__k=n.__k||[]),J&&J.then||Fi(t),O.__e(J,t,n)}}else c=t.__e=ga(n.__e,t,n,i,a,s,o,d,m,e);return(u=O.diffed)&&u(t),c}function qt(e,t){if(e&&e.nodeType==8&&e.data.startsWith("$s"))for(var n=1;e=e.nextSibling;){if(e.nodeType==8){if(e.data.startsWith("$s"))n++;else if(e.data.startsWith("/$s")&&!--n)return e}t&&t.push(e)}}function Fi(e){e&&(e.__c&&(e.__c.__g|=4),e.__k&&e.__k.some(Fi))}function Hi(e,t,n){for(var i=0;i<n.length;)Yn(n[i++],n[i++],n[i++]);O.__c&&O.__c(t,e),e.some(function(a){try{e=a.__h,a.__h=[],e.some(function(s){s.call(a)})}catch(s){O.__e(s,a.__v)}})}function ga(e,t,n,i,a,s,o,c,d,m){var u,y,v,h,T,f,E,b,_=n.props||Zt,x=t.props,C=t.type;if(C=="svg"?a="http://www.w3.org/2000/svg":C=="math"?a="http://www.w3.org/1998/Math/MathML":a||(a="http://www.w3.org/1999/xhtml"),s){for(u=0;u<s.length;u++)if((T=s[u])&&(C?T.localName==C:T.nodeType==3)){e=T,s[u]=null;break}}if(!e){if(b=m.ownerDocument||document,!C)return b.createTextNode(x);e=b.createElementNS(a,C,x.is?x:m),c&&(O.__m&&O.__m(t,s),c=!1),s=null}if(C){if(m=C=="template"&&e.content||e,s=C=="textarea"&&x.defaultValue!=null?null:s&&Un.call(m.childNodes),!c&&s)for(_={},u=0;u<e.attributes.length;u++)_[(T=e.attributes[u]).name]=T.value;for(u in _)T=_[u],u=="dangerouslySetInnerHTML"?v=T:u=="children"||u in x||u=="value"&&"defaultValue"in x||u=="checked"&&"defaultChecked"in x||Vt(e,u,null,T,a);for(u in x)T=x[u],u=="children"?h=T:u=="dangerouslySetInnerHTML"?y=T:u=="value"?f=T:u=="checked"?E=T:c&&typeof T!="function"||_[u]===T||Vt(e,u,T,_[u],a);y?(c||v&&(y.__html==v.__html||y.__html==e.innerHTML)||(e.innerHTML=y.__html),t.__k=[]):(v&&(e.textContent=""),(C=="foreignObject"||a=="http://www.w3.org/1998/Math/MathML"&&ha.test(C))&&(a="http://www.w3.org/1999/xhtml"),wi(m,Hn(h)?h:[h],t,n,i,a,s,o,s?s[0]:n.__k&&we(n,0),c,d),s&&s.some(Ke)),c&&C!="textarea"||(u="value",C=="progress"&&f==null?e.removeAttribute(u):f==null||f===e[u]&&(C!="progress"||f)||Vt(e,u,f,_[u],a),u="checked",E!=null&&E!=e[u]&&Vt(e,u,E,_[u],a))}else _===x||c&&e.data==x||(e.data=x);return e}function Yn(e,t,n,i){try{typeof e=="function"?t?t.__x=e(t)||1:i&&(i=i.__c||i.__e)&&(t=i.__x)&&(i.__x=null,typeof t=="function"?t():e(null)):e.current=t}catch(a){O.__e(a,n)}}function $n(e,t,n){var i,a,s,o;if(O.unmount&&O.unmount(e),!(i=e.ref)||i.current&&i.current!=e.__e||Yn(i,null,t,e),i=e.__c){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(c){O.__e(c,t)}i.__P=i.__n=null}if(i=e.__k)for(o=0;o<i.length;o++)i[o]&&$n(i[o],t,typeof e.type!="function"||n&&!e.props.__P);!n&&(i=e.__c)&&(i=i.__z)&&(a=qt(i,s=[]))&&(i==e.__e&&s.some(Ke),Ke(a),Ke(i)),n||Ke(e.__e),e.__e=e.__c=e.__=null}function _a(e,t,n){return this.constructor(e,n)}function Ui(e,t){var n,i,a,s;O.__&&O.__(e,t),t.nodeType==9&&(t=t.documentElement),i=(n=e&&32&e.__u)?null:t.__k,t.__k=xt($,{children:[e]}),a=[],s=[],zn(t,t.__k,i||Zt,Zt,t.namespaceURI,i?null:t.firstChild?Un.call(t.childNodes):null,a,i?i.__e:t.firstChild,n,s),Hi(a,t.__k,s),t.__k.props.children=null}O={__e:function(e,t,n,i){for(var a,s,o;t=t.__;)if((a=t.__c)&&!(1&a.__g)){a.__g|=4;try{if((o=(s=a.constructor)&&s.getDerivedStateFromError)&&a.setState(s.getDerivedStateFromError(e)),a.componentDidCatch&&(a.componentDidCatch(e,i||{}),o=1),o&&8&a.__g)return void(a.__g|=2)}catch(c){e=c}}throw Jt=0,e}},ki=0,Bn=function(e){return e!=null&&e.constructor===At},st.prototype.setState=function(e,t){var n=this.__s;n&&n!=this.state||(n=this.__s=Ge({},this.state)),typeof e=="function"&&(e=e(Ge({},n),this.props)),e&&(Ge(n,e),this.__v&&(t&&this.__k.push(t),Ii(this)))},st.prototype.forceUpdate=function(e){this.__v&&(this.__g|=4,e&&this.__h.push(e),Ii(this))},st.prototype.render=$,Me=[],Jt=0,Ri=function(e,t){return e.__v.__b-t.__v.__b},jt=Symbol(),Li=/(PointerCapture)$|Capture$/i,Fn=0,wn={},pa=0;var yt,Z,Wn,zi,Kn=Object.is,tn=0,ji=[],Gn=[],V=O,Yi=V.__b,$i=V.__r,Wi=V.diffed,Ki=V.__c,Gi=V.unmount,Xi=V.__;function Qn(e,t){V.__h&&V.__h(Z,e,tn||t),tn=0;var n=Z.__H||(Z.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function W(e){return tn=1,ba(Ji,e)}function ba(e,t,n){var i=Qn(yt++,2);if(i.t=e,!i.__c&&(i.__=[n?n(t):Ji(void 0,t),function(s){var o=(i.__N||i.__)[0],c=i.t(o,s);Kn(o,c)||(i.__N=[c,i.__[1]],i.__c.setState({}))}],i.__c=Z,!Z.__f)){Z.__f=!0;var a=Z.shouldComponentUpdate;Z.shouldComponentUpdate=function(s,o,c){var d=this.__H;if(!d)return!0;var m=!1,u=this.props!=s;if(d.__.some(function(v){v.__N&&(m=!0,Kn(v.__[0],v.__N[0])||(u=!0))}),a){var y=a.call(this,s,o,c);return m?y||u:y}return!m||u}}return i.__}function H(e,t){var n=Qn(yt++,3);!V.__s&&qi(n.__H,t)&&(n.__P=!0,n.__=e,n.u=t,Z.__H.__h.push(n))}function k(e){return tn=5,nn(function(){return{current:e}},[])}function nn(e,t){var n=Qn(yt++,7);return qi(n.__H,t)&&(n.__=e(),n.__H=t),n.__}function xa(){var e;do{for(;e=Gn.shift();)try{vt(e)}catch(n){V.__e(n,{__:(e=e.__P)&&e.__v})}for(;e=ji.shift();){var t=e.__H;if(e.__P&&t)try{t.__h.some(vt),t.__h.some(Xn),t.__h=[]}catch(n){t.__h=[],V.__e(n,e.__v)}}}while(Gn.length)}V.__b=function(e){Z=null,Yi&&Yi(e)},V.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),Xi&&Xi(e,t)},V.__r=function(e){$i&&$i(e),yt=0;var t=(Z=e.__c).__H;t&&(Wn==Z?Z.__h=[]:(t.__h.some(vt),t.__h.some(Xn),yt=0),t.__h=[],t.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0})),Wn=Z},V.diffed=function(e){Wi&&Wi(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&Vi(ji.push(t)),t.__H.__.some(function(n){n.u&&(n.__H=n.u)})),Wn=Z=null},V.__c=function(e,t){t.some(function(n){try{n.__h.some(vt),n.__h=n.__h.filter(function(i){return!i.__||Xn(i)})}catch(i){n.__h=[function(){throw i}]}}),Ki&&Ki(e,t)},V.unmount=function(e){Gi&&Gi(e);var t,n,i=e.__c;i&&i.__H&&(i.__H.__.some(function(a){try{if(a.__P&&a.__c){if(n===void 0){for(n=e.__;n&&(!n.__c||!n.__c.__P);)n=n.__;n=n&&n.__c}a.__P=n,Vi(Gn.push(a))}else vt(a)}catch(s){t=s}}),i.__H=void 0,t&&V.__e(t,i.__v))};var Qi=typeof requestAnimationFrame=="function";function Aa(e){var t,n=function(){clearTimeout(i),Qi&&cancelAnimationFrame(t),setTimeout(e)},i=setTimeout(n,35);Qi&&(t=requestAnimationFrame(n))}function Vi(e){e!=1&&zi==V.requestAnimationFrame||((zi=V.requestAnimationFrame)||Aa)(xa)}function vt(e){var t=Z,n=e.__c;typeof n=="function"&&(e.__c=void 0,n()),Z=t}function Xn(e){var t=Z;e.__c=e.__(),Z=t}function qi(e,t){return!e||e.length!=t.length||t.some(function(n,i){return!Kn(n,e[i])})}function Ji(e,t){return typeof t=="function"?t(e):t}var va=Symbol.for("preact-signals");function on(){if(Ie>1)Ie--;else{var e,t=!1;for((function(){var a=sn;for(sn=void 0;a!==void 0;){var s=a.S;if(s.v===a.v)for(var o=s.t;o!==void 0;o=o.x)o.i===a.i&&(o.i=s.i);a=a.o}})();St!==void 0;){var n=St;for(St=void 0,rn++;n!==void 0;){var i=n.u;if(n.u=void 0,n.f&=-3,!(8&n.f)&&er(n))try{n.c()}catch(a){t||(e=a,t=!0)}n=i}}if(rn=0,Ie--,t)throw e}}function jn(e){if(Ie>0)return e();Vn=++ya,Ie++;try{return e()}finally{on()}}var Ct,G=void 0;function Nt(e){var t=G,n=Ct;G=void 0,Ct=void 0;try{return e()}finally{G=t,Ct=n}}var St=void 0,Ie=0,rn=0,ya=0,Vn=0,sn=void 0,an=0;function Zi(e){if(G!==void 0){var t=e.n;if(t===void 0||t.t!==G)return t={i:0,S:e,p:G.s,n:void 0,t:G,e:void 0,x:void 0,r:t},G.s!==void 0&&(G.s.n=t),G.s=t,e.n=t,32&G.f&&e.S(t),t;if(t.i===-1)return t.i=0,t.n!==void 0&&(t.n.p=t.p,t.p!==void 0&&(t.p.n=t.n),t.p=G.s,t.n=void 0,G.s.n=t,G.s=t),t}}function ee(e,t){this.v=e,this.i=0,this.n=void 0,this.t=void 0,this.l=0,this.W=t?.watched,this.Z=t?.unwatched,this.name=t?.name}ee.prototype.brand=va;ee.prototype.h=function(){return!0};ee.prototype.S=function(e){var t=this,n=this.t;n!==e&&e.e===void 0&&(e.x=n,this.t=e,n!==void 0?n.e=e:Nt(function(){var i;(i=t.W)==null||i.call(t)}))};ee.prototype.U=function(e){var t=this;if(this.t!==void 0){var n=e.e,i=e.x;n!==void 0&&(n.x=i,e.e=void 0),i!==void 0&&(i.e=n,e.x=void 0),e===this.t&&(this.t=i,i===void 0&&Nt(function(){var a;(a=t.Z)==null||a.call(t)}))}};ee.prototype.subscribe=function(e){var t=this;return xe(function(){var n=t.value;Nt(function(){return e(n)})},{name:"sub"})};ee.prototype.valueOf=function(){return this.value};ee.prototype.toString=function(){return this.value+""};ee.prototype.toJSON=function(){return this.value};ee.prototype.peek=function(){var e=this;return Nt(function(){return e.value})};Object.defineProperty(ee.prototype,"value",{get:function(){var e=Zi(this);return e!==void 0&&(e.i=this.i),this.v},set:function(e){if(e!==this.v){if(rn>100)throw new Error("Cycle detected");(function(n){Ie!==0&&rn===0&&n.l!==Vn&&(n.l=Vn,sn={S:n,v:n.v,i:n.i,o:sn})})(this),this.v=e,this.i++,an++,Ie++;try{for(var t=this.t;t!==void 0;t=t.x)t.t.N()}finally{on()}}}});function N(e,t){return new ee(e,t)}function er(e){for(var t=e.s;t!==void 0;t=t.n)if(t.S.i!==t.i||!t.S.h()||t.S.i!==t.i)return!0;return!1}function tr(e){for(var t=e.s;t!==void 0;t=t.n){var n=t.S.n;if(n!==void 0&&(t.r=n),t.S.n=t,t.i=-1,t.n===void 0){e.s=t;break}}}function nr(e){for(var t=e.s,n=void 0;t!==void 0;){var i=t.p;t.i===-1?(t.S.U(t),i!==void 0&&(i.n=t.n),t.n!==void 0&&(t.n.p=i)):n=t,t.S.n=t.r,t.r!==void 0&&(t.r=void 0),t=i}e.s=n}function Xe(e,t){ee.call(this,void 0,t),this.x=e,this.s=void 0,this.g=an-1,this.f=4}Xe.prototype=new ee;Xe.prototype.h=function(){if(this.f&=-3,1&this.f)return!1;if((36&this.f)==32||(this.f&=-5,this.g===an))return!0;if(this.g=an,this.f|=1,this.i>0&&!er(this))return this.f&=-2,!0;var e=G;try{tr(this),G=this;var t=this.x();(16&this.f||this.v!==t||this.i===0)&&(this.v=t,this.f&=-17,this.i++)}catch(n){this.v=n,this.f|=16,this.i++}return G=e,nr(this),this.f&=-2,!0};Xe.prototype.S=function(e){if(this.t===void 0){this.f|=36;for(var t=this.s;t!==void 0;t=t.n)t.S.S(t)}ee.prototype.S.call(this,e)};Xe.prototype.U=function(e){if(this.t!==void 0&&(ee.prototype.U.call(this,e),this.t===void 0)){this.f&=-33;for(var t=this.s;t!==void 0;t=t.n)t.S.U(t)}};Xe.prototype.N=function(){if(!(2&this.f)){this.f|=6;for(var e=this.t;e!==void 0;e=e.x)e.t.N()}};Object.defineProperty(Xe.prototype,"value",{get:function(){if(1&this.f)throw new Error("Cycle detected");var e=Zi(this);if(this.h(),e!==void 0&&(e.i=this.i),16&this.f)throw this.v;return this.v}});function Be(e,t){return new Xe(e,t)}function ir(e){var t=e.j;if(e.j=void 0,typeof t=="function"){Ie++;var n=G;G=void 0;try{t()}catch(i){throw e.f&=-2,e.f|=8,qn(e),i}finally{G=n,on()}}}function qn(e){for(var t=e.s;t!==void 0;t=t.n)t.S.U(t);e.x=void 0,e.s=void 0,ir(e)}function Ca(e){if(G!==this)throw new Error("Out-of-order effect");nr(this),G=e,this.f&=-2;try{8&this.f&&qn(this)}finally{on()}}function at(e,t){this.x=e,this.j=void 0,this.s=void 0,this.u=void 0,this.f=32,this.name=t?.name,Ct&&Ct.push(this)}at.prototype.c=function(){var e=this.S();try{if(8&this.f||this.x===void 0)return;var t=this.x();typeof t=="function"&&(this.j=t)}finally{e()}};at.prototype.S=function(){if(1&this.f)throw new Error("Cycle detected");this.f|=1,this.f&=-9,ir(this),tr(this),Ie++;var e=G;return G=this,Ca.bind(this,e)};at.prototype.N=function(){2&this.f||(this.f|=2,this.u=St,St=this)};at.prototype.d=function(){this.f|=8,1&this.f||qn(this)};at.prototype.dispose=function(){this.d()};function xe(e,t){var n=new at(e,t);try{n.c()}catch(a){throw n.d(),a}var i=n.d.bind(n);return i[Symbol.dispose]=i,i}var rr,cn,ln,Sa=typeof window<"u"&&!!window.__PREACT_SIGNALS_DEVTOOLS__;var sr=[];xe(function(){rr=this.N})();function ot(e,t){O[e]=t.bind(null,O[e]||function(){})}function It(e){if(ln){var t=ln;ln=void 0,t()}ln=e&&e.S()}function ar(e){var t=this,n=e.data,i=Ia(n);i.name="ReactiveDom",i.value=n;var a=nn(function(){for(var c=t,d=t.__v;d=d.__;)if(d.__c){d.__c.__$f|=4;break}var m=Be(function(){var h=i.value.value;return h===0?0:h===!0?"":h||""}),u=Be(function(){return!Array.isArray(m.value)&&!Bn(m.value)}),y=xe(function(){if(this.N=or,u.value){var h=m.value;c.__v&&c.__v.__e&&c.__v.__e.nodeType===3&&(c.__v.__e.data=h)}}),v=t.__$u.d;return t.__$u.d=function(){y(),v.call(this)},[u,m]},[]),s=a[0],o=a[1];return s.value?o.peek():o.value}ar.displayName="ReactiveTextNode";Object.defineProperties(ee.prototype,{constructor:{configurable:!0,value:Di($,null).constructor},type:{configurable:!0,value:ar},props:{configurable:!0,get:function(){var e=this;return{data:{get value(){return e.value}}}}},__b:{configurable:!0,value:1}});ot("__b",function(e,t){if(It(),cn=void 0,typeof t.type=="string"){var n,i=t.props;for(var a in i)if(a!=="children"){var s=i[a];s instanceof ee&&(n||(t.__np=n={}),n[a]=s,i[a]=s.peek())}}e(t)});ot("__r",function(e,t){if(e(t),t.type!==$){It();var n,i=t.__c;i&&(i.__$f&=-2,(n=i.__$u)===void 0&&(i.__$u=n=(function(a,s){var o;return xe(function(){o=this},{name:s}),o.c=a,o})((function(a){return function(){var s;Sa&&((s=this.y)==null||s.call(this)),a.__$f|=1,a.setState({})}})(i),typeof t.type=="function"?t.type.displayName||t.type.name:""))),cn=i,It(n)}});ot("__e",function(e,t,n,i){It(),cn=void 0,e(t,n,i)});ot("diffed",function(e,t){It(),cn=void 0;var n;if(typeof t.type=="string"&&(n=t.__e)){var i=t.__np,a=t.props,s=n.U;if(s)for(var o in s){var c=s[o];c===void 0||i&&o in i||(c.d(),s[o]=void 0)}if(i){s||(s={},n.U=s);for(var d in i){var m=s[d],u=i[d];m===void 0?(m=Na(n,d,u,a),s[d]=m):m.o(u,a)}}}e(t)});function Na(e,t,n,i){var a=t in e&&e.ownerSVGElement===void 0,s=N(n);return{o:function(o,c){s.value=o,i=c},d:xe(function(){this.N=or;var o=s.value.value;i[t]!==o&&(i[t]=o,a?e[t]=o:o!=null&&(o!==!1||t[4]==="-")?e.setAttribute(t,o):e.removeAttribute(t))})}}ot("unmount",function(e,t){if(typeof t.type=="string"){var n=t.__e;if(n){var i=n.U;if(i){n.U=void 0;for(var a in i){var s=i[a];s&&s.d()}}}var o=t.__np;if(o){var c=t.props;for(var d in o)c[d]=o[d]}t.__np=void 0}else{var m=t.__c;if(m){m.__$f|=8;var u=m.__$u;u&&(m.__$u=void 0,u.d())}}e(t)});ot("__h",function(e,t,n,i){i<3&&(t.__$f|=2),e(t,n,i)});st.prototype.shouldComponentUpdate=function(e,t){if(this.__R)return!0;var n=this.__$u,i=n&&n.s!==void 0;for(var a in t)return!0;if(this.__f||typeof this.u=="boolean"&&this.u===!0){var s=2&this.__$f;if(!(i||s||4&this.__$f)||1&this.__$f)return!0}else if(!(i||4&this.__$f)||3&this.__$f)return!0;for(var o in e)if(o!=="__source"&&e[o]!==this.props[o])return!0;for(var c in this.props)if(!(c in e))return!0;return!1};function Ia(e,t){return nn(function(){return N(e,t)},[])}var Oa=function(e){queueMicrotask(function(){queueMicrotask(e)})};function ka(){jn(function(){for(var e;e=sr.shift();)rr.call(e)})}function or(){sr.push(this)===1&&(O.requestAnimationFrame||Oa)(ka)}var ct=class extends Error{constructor(n,i){super(typeof i.message=="string"?i.message:`HTTP ${n}`);bt(this,"status");bt(this,"code");bt(this,"body");this.name="ApiError",this.status=n,this.code=typeof i.error=="string"?i.error:"http",this.body=i}},Ra=typeof location>"u"?new URLSearchParams:new URLSearchParams(location.search),lr=Ra.get("t")??"",ut=Math.random().toString(36).slice(2)+Date.now().toString(36),Qe=e=>`${e}${e.includes("?")?"&":"?"}t=${encodeURIComponent(lr)}`;async function cr(e){let t=await e.text(),n={};try{n=t?JSON.parse(t):{}}catch{n={message:t.slice(0,200)}}if(!e.ok)throw new ct(e.status,n);return n}async function lt(e){return cr(await fetch(Qe(e)))}async function fe(e,t){return cr(await fetch(e,{method:"POST",headers:{"X-NM-Token":lr,"Content-Type":"application/json"},body:JSON.stringify(t)}))}var P={state:()=>lt("/api/state"),outline:(e,t=8)=>lt(`/api/outline?slide=${e}&depth=${t}`),ops:(e,t,n={})=>fe("/api/ops",{ops:e,baseVersion:t,clientId:ut,...n}),undo:()=>fe("/api/undo",{}),redo:()=>fe("/api/redo",{}),save:()=>fe("/api/save",{}),resolve:e=>fe("/api/resolve",{strategy:e}),createNote:(e,t)=>fe("/api/notes",{text:e,target:t}),doneNote:e=>fe("/api/notes/done",{id:e}),current:(e,t)=>fe("/api/current",{slide:e,...t?{key:t}:{}}),layoutPresets:()=>lt("/api/layout-presets"),layoutPreset:e=>lt(`/api/layout-preset?id=${encodeURIComponent(e)}`),uploadImage:e=>fe("/api/assets",e),createAiRequest:(e,t,n)=>fe("/api/ai/requests",{prompt:e,key:t,kind:n}),aiRequest:e=>lt(`/api/ai/requests/${encodeURIComponent(e)}`),acceptAiRequest:e=>fe(`/api/ai/requests/${encodeURIComponent(e)}/accept`,{}),createExport:(e,t)=>fe("/api/exports",{format:e,allowRemote:t}),exportJob:e=>lt(`/api/exports/${encodeURIComponent(e)}`),rejectAiRequest:e=>fe(`/api/ai/requests/${encodeURIComponent(e)}/reject`,{})},ur=()=>Qe(`/preview?r=${Date.now().toString(36)}`),dr=()=>Qe(`/thumbnail?r=${Date.now().toString(36)}`),pr=e=>Qe(`/ui/fonts/${e}`),hr=e=>Qe(`/api/exports/${encodeURIComponent(e)}/download`);var dn={};da(dn,{areaTargeting:()=>_e,banner:()=>se,bumpLayout:()=>ke,conflict:()=>ce,connected:()=>je,currentSlide:()=>D,exportOpen:()=>ve,fihrisCompact:()=>be,fitZoom:()=>dt,flags:()=>ne,hover:()=>ie,info:()=>le,lang:()=>te,layoutTick:()=>Ve,lint:()=>Oe,liveTitles:()=>un,noteArea:()=>re,noteTargetMode:()=>kt,notes:()=>ge,panelTab:()=>q,playing:()=>ae,saveRefused:()=>Ce,saving:()=>Ue,selectedKeys:()=>w,selection:()=>R,slideCount:()=>Le,slideTitle:()=>qe,t:()=>B,textSession:()=>Ae,toast:()=>Re,version:()=>oe,workspaceMode:()=>He,zoom:()=>j,zoomMode:()=>Fe});var La="\\u0660\\u0661\\u0662\\u0663\\u0664\\u0665\\u0666\\u0667\\u0668\\u0669";function Te(e,t){let n=String(e);return t==="ar"?n.replace(/[0-9]/g,i=>La[Number(i)]):n}var fr=e=>String(e).padStart(2,"0");function Da(e){return e===1?"\\u0633\\u0637\\u0631":e===2?"\\u0633\\u0637\\u0631\\u0627\\u0646":e%100>=3&&e%100<=10?"\\u0623\\u0633\\u0637\\u0631":"\\u0633\\u0637\\u0631\\u064B\\u0627"}var Pa={appName:"\\u0646\\u064A\\u0641\\u0631\\u0645\\u0627\\u064A\\u0646\\u062F",appSub:"\\u0627\\u0633\\u062A\\u0648\\u062F\\u064A\\u0648",documentTitle:e=>`${e} \\xB7 \\u0646\\u064A\\u0641\\u0631\\u0645\\u0627\\u064A\\u0646\\u062F \\u0627\\u0633\\u062A\\u0648\\u062F\\u064A\\u0648`,modesLabel:"\\u0623\\u062F\\u0648\\u0627\\u062A \\u0627\\u0644\\u0645\\u062D\\u0631\\u0651\\u0631",modeEdit:"\\u062A\\u062D\\u0631\\u064A\\u0631",modeInsert:"\\u0625\\u062F\\u0631\\u0627\\u062C",modeMotion:"\\u0627\\u0644\\u062D\\u0631\\u0643\\u0629",modeIdentity:"\\u0627\\u0644\\u0647\\u0648\\u064A\\u0629",modeLater:"\\u062A\\u0635\\u0644 \\u0647\\u0630\\u0647 \\u0627\\u0644\\u0623\\u062F\\u0648\\u0627\\u062A \\u0641\\u064A \\u062A\\u062D\\u062F\\u064A\\u062B \\u0642\\u0627\\u062F\\u0645",saved:"\\u0645\\u062D\\u0641\\u0648\\u0638",unsaved:"\\u063A\\u064A\\u0631 \\u0645\\u062D\\u0641\\u0648\\u0638",linesWord:e=>Da(e),linesLabel:e=>`${Te(e,"ar")} ${e===1?"\\u0633\\u0637\\u0631 \\u062A\\u063A\\u064A\\u0651\\u0631":e===2?"\\u0633\\u0637\\u0631\\u0627\\u0646 \\u062A\\u063A\\u064A\\u0651\\u0631\\u0627":"\\u0623\\u0633\\u0637\\u0631 \\u062A\\u063A\\u064A\\u0651\\u0631\\u062A"} \\u0639\\u0646 \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0627\\u0644\\u0645\\u062D\\u0641\\u0648\\u0638`,undo:"\\u062A\\u0631\\u0627\\u062C\\u0639",redo:"\\u0625\\u0639\\u0627\\u062F\\u0629",play:"\\u0634\\u063A\\u0651\\u0644 \\u062D\\u0631\\u0643\\u0629 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",pause:"\\u0623\\u0648\\u0642\\u0641 \\u0627\\u0644\\u062D\\u0631\\u0643\\u0629 \\u0648\\u0639\\u064F\\u062F \\u0625\\u0644\\u0649 \\u0627\\u0644\\u062A\\u062D\\u0631\\u064A\\u0631",langButton:"EN",langSwitch:"Switch to English",save:"\\u062D\\u0641\\u0638",saving:"\\u064A\\u062D\\u0641\\u0638",savedToast:"\\u062D\\u064F\\u0641\\u0638 \\u0627\\u0644\\u0645\\u0644\\u0641",canvasLabel:"\\u0644\\u0648\\u062D\\u0629 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",previewTitle:"\\u0645\\u0639\\u0627\\u064A\\u0646\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636",zoomFit:"\\u0645\\u0644\\u0627\\u0621\\u0645\\u0629 \\u0627\\u0644\\u0634\\u0627\\u0634\\u0629",zoomLabel:"\\u0646\\u0633\\u0628\\u0629 \\u0627\\u0644\\u062A\\u0643\\u0628\\u064A\\u0631",tabsLabel:"\\u0644\\u0648\\u062D\\u0629 \\u0627\\u0644\\u0639\\u0646\\u0635\\u0631",tabProps:"\\u0627\\u0644\\u062E\\u0635\\u0627\\u0626\\u0635",tabLayers:"\\u0627\\u0644\\u0637\\u0628\\u0642\\u0627\\u062A",tabAgent:"\\u0644\\u0644\\u0648\\u0643\\u064A\\u0644",aiTitle:"\\u0627\\u0637\\u0644\\u0628 \\u062A\\u0639\\u062F\\u064A\\u0644\\u064B\\u0627 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0645\\u062D\\u062F\\u062F",aiIntro:"\\u0627\\u0643\\u062A\\u0628 \\u0627\\u0644\\u0646\\u062A\\u064A\\u062C\\u0629 \\u0627\\u0644\\u062A\\u064A \\u062A\\u0631\\u064A\\u062F\\u0647\\u0627. \\u064A\\u0639\\u0631\\u0636 \\u0627\\u0644\\u0645\\u062D\\u0631\\u0651\\u0631 \\u0641\\u0631\\u0642 \\u0627\\u0644\\u0645\\u0635\\u062F\\u0631 \\u0642\\u0628\\u0644 \\u0623\\u0646 \\u064A\\u0637\\u0628\\u0651\\u0642 \\u0634\\u064A\\u0626\\u064B\\u0627.",aiSelect:"\\u062D\\u062F\\u0651\\u062F \\u0639\\u0646\\u0635\\u0631\\u064B\\u0627 \\u0641\\u064A \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0623\\u0648\\u0644\\u064B\\u0627\\u060C \\u062B\\u0645 \\u0627\\u0643\\u062A\\u0628 \\u0627\\u0644\\u062A\\u0639\\u062F\\u064A\\u0644 \\u0627\\u0644\\u0645\\u0637\\u0644\\u0648\\u0628.",aiKind:"\\u0646\\u0648\\u0639 \\u0637\\u0644\\u0628 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644",aiEditElement:"\\u062A\\u0639\\u062F\\u064A\\u0644 \\u0627\\u0644\\u0639\\u0646\\u0635\\u0631",aiRegenerateImage:"\\u0625\\u0639\\u0627\\u062F\\u0629 \\u062A\\u0648\\u0644\\u064A\\u062F \\u0627\\u0644\\u0635\\u0648\\u0631\\u0629",aiPrompt:"\\u0627\\u0644\\u0637\\u0644\\u0628",aiPlaceholder:"\\u0645\\u062B\\u0627\\u0644: \\u0627\\u062E\\u062A\\u0635\\u0631 \\u0647\\u0630\\u0627 \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u0645\\u0639 \\u0627\\u0644\\u062D\\u0641\\u0627\\u0638 \\u0639\\u0644\\u0649 \\u0646\\u0628\\u0631\\u062A\\u0647.",aiImagePlaceholder:"\\u0635\\u0641 \\u0627\\u0644\\u0635\\u0648\\u0631\\u0629 \\u0627\\u0644\\u062C\\u062F\\u064A\\u062F\\u0629 \\u0648\\u0627\\u0644\\u0623\\u0633\\u0644\\u0648\\u0628 \\u0648\\u0627\\u0644\\u062A\\u0643\\u0648\\u064A\\u0646 \\u0627\\u0644\\u0645\\u0637\\u0644\\u0648\\u0628.",aiSubmit:"\\u0627\\u0639\\u0631\\u0636 \\u0627\\u0642\\u062A\\u0631\\u0627\\u062D \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644",aiRunning:"\\u064A\\u0639\\u0645\\u0644 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644 \\u0639\\u0644\\u0649 \\u0646\\u0633\\u062E\\u0629 \\u0645\\u0639\\u0632\\u0648\\u0644\\u0629\\u2026",aiReady:"\\u0627\\u0644\\u0627\\u0642\\u062A\\u0631\\u0627\\u062D \\u062C\\u0627\\u0647\\u0632 \\u0644\\u0644\\u0645\\u0631\\u0627\\u062C\\u0639\\u0629.",aiAccepted:"\\u0642\\u064F\\u0628\\u0644 \\u0627\\u0644\\u0627\\u0642\\u062A\\u0631\\u0627\\u062D. \\u064A\\u0645\\u0643\\u0646\\u0643 \\u0627\\u0644\\u062A\\u0631\\u0627\\u062C\\u0639 \\u0639\\u0646\\u0647 \\u0628\\u062E\\u0637\\u0648\\u0629 \\u0648\\u0627\\u062D\\u062F\\u0629.",aiRejected:"\\u0631\\u064F\\u0641\\u0636 \\u0627\\u0644\\u0627\\u0642\\u062A\\u0631\\u0627\\u062D \\u0648\\u0644\\u0645 \\u064A\\u062A\\u063A\\u064A\\u0651\\u0631 \\u0627\\u0644\\u0645\\u0644\\u0641.",exportOpen:"\\u062A\\u0635\\u062F\\u064A\\u0631 \\u0627\\u0644\\u0639\\u0631\\u0636",exportTitle:"\\u062A\\u0635\\u062F\\u064A\\u0631 \\u0627\\u0644\\u0639\\u0631\\u0636",exportIntro:"\\u064A\\u064F\\u0635\\u062F\\u064E\\u0651\\u0631 \\u0645\\u0627 \\u062A\\u0631\\u0627\\u0647 \\u0627\\u0644\\u0622\\u0646 \\u0641\\u064A \\u0627\\u0644\\u0645\\u062D\\u0631\\u0651\\u0631\\u060C \\u0628\\u0645\\u0627 \\u0641\\u064A\\u0647 \\u0627\\u0644\\u062A\\u063A\\u064A\\u064A\\u0631\\u0627\\u062A \\u063A\\u064A\\u0631 \\u0627\\u0644\\u0645\\u062D\\u0641\\u0648\\u0638\\u0629. \\u0644\\u0627 \\u064A\\u062A\\u063A\\u064A\\u0651\\u0631 \\u0645\\u0644\\u0641 \\u0627\\u0644\\u0639\\u0631\\u0636.",exportFormatLabel:"\\u0635\\u064A\\u063A\\u0629 \\u0627\\u0644\\u062A\\u0635\\u062F\\u064A\\u0631",exportHtml:"\\u0645\\u0644\\u0641 HTML \\u0645\\u062D\\u0645\\u0648\\u0644",exportHtmlHint:"\\u0645\\u0644\\u0641 \\u0648\\u0627\\u062D\\u062F \\u064A\\u0639\\u0645\\u0644 \\u062F\\u0648\\u0646 \\u0625\\u0646\\u062A\\u0631\\u0646\\u062A\\u060C \\u0648\\u0641\\u064A\\u0647 \\u0627\\u0644\\u0635\\u0648\\u0631 \\u0648\\u0627\\u0644\\u062E\\u0637\\u0648\\u0637.",exportPdf:"\\u0645\\u0644\\u0641 PDF",exportPdfHint:"\\u0635\\u0641\\u062D\\u0629 \\u0644\\u0643\\u0644 \\u0634\\u0631\\u064A\\u062D\\u0629 \\u0628\\u0645\\u0642\\u0627\\u0633 \\u0661\\u0669\\u0662\\u0660 \\xD7 \\u0661\\u0660\\u0668\\u0660.",exportPng:"\\u0635\\u0648\\u0631 PNG",exportPngHint:"\\u0635\\u0648\\u0631\\u0629 \\u0644\\u0643\\u0644 \\u0634\\u0631\\u064A\\u062D\\u0629\\u060C \\u0641\\u064A \\u0623\\u0631\\u0634\\u064A\\u0641 ZIP \\u0625\\u0646 \\u062A\\u0639\\u062F\\u062F\\u062A.",exportPptx:"PowerPoint \\u0628\\u0635\\u0648\\u0631 \\u0627\\u0644\\u0634\\u0631\\u0627\\u0626\\u062D",exportPptxHint:"\\u0643\\u0644 \\u0634\\u0631\\u064A\\u062D\\u0629 \\u0635\\u0648\\u0631\\u0629 \\u0643\\u0627\\u0645\\u0644\\u0629\\u060C \\u0644\\u0627 \\u0646\\u0635 \\u0642\\u0627\\u0628\\u0644\\u064B\\u0627 \\u0644\\u0644\\u062A\\u062D\\u0631\\u064A\\u0631.",exportPptxEditable:"PowerPoint \\u0628\\u0646\\u0635 \\u0642\\u0627\\u0628\\u0644 \\u0644\\u0644\\u062A\\u062D\\u0631\\u064A\\u0631",exportPptxEditableHint:"\\u0627\\u0644\\u0646\\u0635 \\u0635\\u0646\\u0627\\u062F\\u064A\\u0642 \\u0645\\u0646\\u0641\\u0635\\u0644\\u0629 \\u0641\\u0648\\u0642 \\u0627\\u0644\\u062E\\u0644\\u0641\\u064A\\u0629.",exportExperimental:"\\u062A\\u062C\\u0631\\u064A\\u0628\\u064A",exportAllowRemote:"\\u0623\\u0628\\u0642\\u0650 \\u0627\\u0644\\u0631\\u0648\\u0627\\u0628\\u0637 \\u0627\\u0644\\u062E\\u0627\\u0631\\u062C\\u064A\\u0629 (\\u064A\\u062D\\u062A\\u0627\\u062C \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0627\\u062A\\u0635\\u0627\\u0644\\u064B\\u0627 \\u0628\\u0627\\u0644\\u0625\\u0646\\u062A\\u0631\\u0646\\u062A)",exportRun:"\\u0635\\u062F\\u0651\\u0631",exportRunning:"\\u064A\\u062C\\u0631\\u064A \\u0627\\u0644\\u062A\\u0635\\u062F\\u064A\\u0631. \\u0642\\u062F \\u064A\\u0633\\u062A\\u063A\\u0631\\u0642 \\u062F\\u0642\\u064A\\u0642\\u0629.",exportReady:(e,t)=>`\\u062C\\u0627\\u0647\\u0632: ${e} (${Te(t,"ar")} ${t===1?"\\u0634\\u0631\\u064A\\u062D\\u0629":"\\u0634\\u0631\\u0627\\u0626\\u062D"})`,exportDownload:"\\u0646\\u0632\\u0651\\u0644 \\u0627\\u0644\\u0645\\u0644\\u0641",exportFailed:e=>`\\u062A\\u0639\\u0630\\u0651\\u0631 \\u0627\\u0644\\u062A\\u0635\\u062F\\u064A\\u0631: ${e}`,exportClose:"\\u0625\\u063A\\u0644\\u0627\\u0642",exportWarnTitle:"\\u062A\\u0646\\u0628\\u064A\\u0647\\u0627\\u062A \\u0642\\u0628\\u0644 \\u0627\\u0644\\u0645\\u0634\\u0627\\u0631\\u0643\\u0629",exportFontWarn:"\\u0644\\u0645 \\u064A\\u064F\\u0639\\u062B\\u0631 \\u0639\\u0644\\u0649 \\u062A\\u0631\\u062E\\u064A\\u0635 \\u0642\\u0631\\u0628 \\u0627\\u0644\\u062E\\u0637:",exportFontNote:"\\u062A\\u0636\\u0645\\u064A\\u0646 \\u0627\\u0644\\u062E\\u0637 \\u0641\\u064A \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0644\\u0627 \\u064A\\u0645\\u0646\\u062D \\u062D\\u0642 \\u0625\\u0639\\u0627\\u062F\\u0629 \\u062A\\u0648\\u0632\\u064A\\u0639\\u0647. \\u0631\\u0627\\u062C\\u0639 \\u0631\\u062E\\u0635\\u0629 \\u0643\\u0644 \\u062E\\u0637 \\u0642\\u0628\\u0644 \\u0627\\u0644\\u0645\\u0634\\u0627\\u0631\\u0643\\u0629.",exportRemoteWarn:e=>`${e} \\u0631\\u0627\\u0628\\u0637 \\u062E\\u0627\\u0631\\u062C\\u064A\\u060C \\u0648\\u064A\\u062D\\u062A\\u0627\\u062C \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0627\\u062A\\u0635\\u0627\\u0644\\u064B\\u0627 \\u0628\\u0627\\u0644\\u0625\\u0646\\u062A\\u0631\\u0646\\u062A \\u0644\\u064A\\u0639\\u0645\\u0644 \\u0643\\u0627\\u0645\\u0644\\u064B\\u0627.`,exportExperimentalWarn:"\\u0627\\u0644\\u062A\\u0635\\u062F\\u064A\\u0631 \\u0627\\u0644\\u0642\\u0627\\u0628\\u0644 \\u0644\\u0644\\u062A\\u062D\\u0631\\u064A\\u0631 \\u062A\\u062C\\u0631\\u064A\\u0628\\u064A: \\u0635\\u0646\\u0627\\u062F\\u064A\\u0642 \\u0627\\u0644\\u0646\\u0635 \\u0645\\u0642\\u064A\\u0633\\u0629 \\u0645\\u0646 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0627\\u0644\\u0645\\u0631\\u0633\\u0648\\u0645\\u0629\\u060C \\u0648\\u062A\\u062D\\u062A\\u0627\\u062C \\u0627\\u0644\\u062E\\u0637\\u0648\\u0637 \\u0625\\u0644\\u0649 \\u0623\\u0646 \\u062A\\u0643\\u0648\\u0646 \\u0645\\u062B\\u0628\\u0651\\u062A\\u0629 \\u0639\\u0644\\u0649 \\u062C\\u0647\\u0627\\u0632 \\u0627\\u0644\\u0639\\u0631\\u0636.",aiFailed:e=>`\\u062A\\u0639\\u0630\\u0651\\u0631 \\u0625\\u0639\\u062F\\u0627\\u062F \\u0627\\u0644\\u0627\\u0642\\u062A\\u0631\\u0627\\u062D: ${e}`,aiDiff:"\\u0627\\u0644\\u0641\\u0631\\u0642 \\u0642\\u0628\\u0644 \\u0627\\u0644\\u0642\\u0628\\u0648\\u0644",aiReject:"\\u0631\\u0641\\u0636",aiAccept:"\\u0642\\u0628\\u0648\\u0644 \\u0627\\u0644\\u062A\\u0639\\u062F\\u064A\\u0644",roleMainTitle:"\\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646 \\u0627\\u0644\\u0631\\u0626\\u064A\\u0633",roleHeading:"\\u0639\\u0646\\u0648\\u0627\\u0646",roleText:"\\u0646\\u0635",roleImage:"\\u0635\\u0648\\u0631\\u0629",roleFigure:"\\u0645\\u062C\\u0633\\u0651\\u0645",roleGroup:"\\u0645\\u062C\\u0645\\u0648\\u0639\\u0629",roleShape:"\\u0634\\u0643\\u0644",roleSlide:"\\u0634\\u0631\\u064A\\u062D\\u0629",slideN:e=>`\\u0634\\u0631\\u064A\\u062D\\u0629 ${Te(e,"ar")}`,breadcrumbLabel:"\\u0645\\u0633\\u0627\\u0631 \\u0627\\u0644\\u0639\\u0646\\u0635\\u0631",noSelection:"\\u0627\\u0646\\u0642\\u0631 \\u0639\\u0646\\u0635\\u0631\\u064B\\u0627 \\u0641\\u064A \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0644\\u062A\\u0631\\u0649 \\u062E\\u0635\\u0627\\u0626\\u0635\\u0647. \\u0627\\u0644\\u0646\\u0642\\u0631 \\u0627\\u0644\\u0645\\u0632\\u062F\\u0648\\u062C \\u064A\\u0646\\u0632\\u0644 \\u062F\\u0627\\u062E\\u0644 \\u0627\\u0644\\u0645\\u062C\\u0645\\u0648\\u0639\\u0629\\u060C \\u0648 Esc \\u064A\\u0635\\u0639\\u062F \\u0645\\u0646\\u0647\\u0627.",sizeUnit:"px \\xB7 \\u0627\\u0644\\u062D\\u062C\\u0645",sizeLabel:"\\u062D\\u062C\\u0645 \\u0627\\u0644\\u062E\\u0637",typoMixed:"\\u0623\\u0633\\u0637\\u0631 \\u0628\\u062A\\u0646\\u0633\\u064A\\u0642\\u0627\\u062A \\u0645\\u062E\\u062A\\u0644\\u0641\\u0629\\u061B \\u0627\\u0644\\u062A\\u0639\\u062F\\u064A\\u0644 \\u064A\\u064F\\u0637\\u0628\\u064E\\u0651\\u0642 \\u0639\\u0644\\u064A\\u0647\\u0627 \\u0643\\u0644\\u0647\\u0627",fontFamily:"\\u0627\\u0644\\u062E\\u0637",weightLabel:"\\u0648\\u0632\\u0646 \\u0627\\u0644\\u062E\\u0637",weightLight:"\\u062E\\u0641\\u064A\\u0641",weightRegular:"\\u0639\\u0627\\u062F\\u064A",weightBold:"\\u0639\\u0631\\u064A\\u0636",weightBlack:"\\u0623\\u0633\\u0648\\u062F",textColour:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u0646\\u0635",fillColour:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u062A\\u0639\\u0628\\u0626\\u0629",colourFromDeck:e=>`\\u0645\\u0646 \\u0647\\u0648\\u064A\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636 \\xB7 ${e}`,colourOutside:e=>`\\u062E\\u0627\\u0631\\u062C \\u0647\\u0648\\u064A\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636 \\xB7 ${e}`,deckColours:"\\u0623\\u0644\\u0648\\u0627\\u0646 \\u0647\\u0648\\u064A\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636",lineHeight:"\\u0627\\u0631\\u062A\\u0641\\u0627\\u0639 \\u0627\\u0644\\u0633\\u0637\\u0631",lineHeightNormal:"\\u062A\\u0644\\u0642\\u0627\\u0626\\u064A",opacity:"\\u0627\\u0644\\u0634\\u0641\\u0627\\u0641\\u064A\\u0629",positionLabel:"\\u0627\\u0644\\u0645\\u0648\\u0636\\u0639 \\u0648\\u0627\\u0644\\u0645\\u0642\\u0627\\u0633",fromRight:"\\u0645\\u0646 \\u0627\\u0644\\u064A\\u0645\\u064A\\u0646",fromLeft:"\\u0645\\u0646 \\u0627\\u0644\\u064A\\u0633\\u0627\\u0631",fromTop:"\\u0645\\u0646 \\u0627\\u0644\\u0623\\u0639\\u0644\\u0649",fromBottom:"\\u0645\\u0646 \\u0627\\u0644\\u0623\\u0633\\u0641\\u0644",width:"\\u0627\\u0644\\u0639\\u0631\\u0636",height:"\\u0627\\u0644\\u0627\\u0631\\u062A\\u0641\\u0627\\u0639",inFlow:"\\u064A\\u062A\\u0628\\u0639 \\u062A\\u0631\\u062A\\u064A\\u0628 \\u062D\\u0627\\u0648\\u064A\\u062A\\u0647",freePosition:"\\u062A\\u062D\\u0631\\u064A\\u0631 \\u0627\\u0644\\u0645\\u0648\\u0636\\u0639",spacing:"\\u0627\\u0644\\u0645\\u0633\\u0627\\u0641\\u0627\\u062A",padding:"\\u0627\\u0644\\u062D\\u0634\\u0648",margin:"\\u0627\\u0644\\u0647\\u0627\\u0645\\u0634",radius:"\\u0627\\u0633\\u062A\\u062F\\u0627\\u0631\\u0629 \\u0627\\u0644\\u062D\\u0648\\u0627\\u0641",shadow:"\\u0627\\u0644\\u0638\\u0644",shadowNone:"\\u0628\\u0644\\u0627 \\u0638\\u0644",borderWidth:"\\u0633\\u064F\\u0645\\u0643 \\u0627\\u0644\\u062D\\u062F",borderColour:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u062D\\u062F",imageFit:"\\u0642\\u0635 \\u0627\\u0644\\u0635\\u0648\\u0631\\u0629",imageCover:"\\u0645\\u0644\\u0621 \\u0627\\u0644\\u0625\\u0637\\u0627\\u0631",imageContain:"\\u0625\\u0638\\u0647\\u0627\\u0631 \\u0643\\u0627\\u0645\\u0644\\u0629",focalX:"\\u0646\\u0642\\u0637\\u0629 \\u0627\\u0644\\u062A\\u0631\\u0643\\u064A\\u0632 \\u0627\\u0644\\u0623\\u0641\\u0642\\u064A\\u0629",focalY:"\\u0646\\u0642\\u0637\\u0629 \\u0627\\u0644\\u062A\\u0631\\u0643\\u064A\\u0632 \\u0627\\u0644\\u0631\\u0623\\u0633\\u064A\\u0629",replaceImage:"\\u0627\\u0633\\u062A\\u0628\\u062F\\u0627\\u0644 \\u0627\\u0644\\u0635\\u0648\\u0631\\u0629",morphLinked:"\\u0645\\u0631\\u062A\\u0628\\u0637 \\u0628\\u0640 Morph",morphWith:e=>`\\u0645\\u0639 ${e.map(t=>`\\u0634\\u0631\\u064A\\u062D\\u0629 ${Te(t,"ar")}`).join("\\u060C ")}`,issuesLabel:"\\u062A\\u0646\\u0628\\u064A\\u0647\\u0627\\u062A",layersEmpty:"\\u0644\\u0627 \\u0639\\u0646\\u0627\\u0635\\u0631 \\u0641\\u064A \\u0647\\u0630\\u0647 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629.",layersLabel:"\\u0637\\u0628\\u0642\\u0627\\u062A \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",layerUp:"\\u0627\\u0631\\u0641\\u0639 \\u0627\\u0644\\u0637\\u0628\\u0642\\u0629",layerDown:"\\u0627\\u062E\\u0641\\u0636 \\u0627\\u0644\\u0637\\u0628\\u0642\\u0629",layerHide:"\\u0623\\u062E\\u0641\\u0650 \\u0627\\u0644\\u0637\\u0628\\u0642\\u0629",layerShow:"\\u0623\\u0638\\u0647\\u0631 \\u0627\\u0644\\u0637\\u0628\\u0642\\u0629",agentEmpty:"\\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F \\u0645\\u0644\\u0627\\u062D\\u0638\\u0627\\u062A \\u0645\\u0641\\u062A\\u0648\\u062D\\u0629. \\u062D\\u062F\\u0651\\u062F \\u0639\\u0646\\u0635\\u0631\\u064B\\u0627 \\u0623\\u0648 \\u0627\\u0631\\u0633\\u0645 \\u0645\\u0646\\u0637\\u0642\\u0629\\u060C \\u062B\\u0645 \\u0627\\u0643\\u062A\\u0628 \\u0645\\u0627 \\u062A\\u0631\\u064A\\u062F \\u0645\\u0646 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644.",agentIntro:"\\u062B\\u0628\\u0651\\u062A \\u0645\\u0627 \\u0644\\u0627 \\u062A\\u0631\\u064A\\u062F \\u062A\\u0646\\u0641\\u064A\\u0630\\u0647 \\u064A\\u062F\\u0648\\u064A\\u064B\\u0627\\u060C \\u0648\\u0633\\u064A\\u062C\\u062F\\u0647 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644 \\u0645\\u0639 \\u0633\\u064A\\u0627\\u0642 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0648\\u0627\\u0644\\u0639\\u0646\\u0635\\u0631.",noteText:"\\u0627\\u0644\\u0645\\u0644\\u0627\\u062D\\u0638\\u0629 \\u0644\\u0644\\u0648\\u0643\\u064A\\u0644",notePlaceholder:"\\u0645\\u062B\\u0627\\u0644: \\u0627\\u062E\\u062A\\u0635\\u0631 \\u0647\\u0630\\u0627 \\u0627\\u0644\\u0639\\u0646\\u0648\\u0627\\u0646\\u060C \\u0648\\u062D\\u0627\\u0641\\u0638 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0646\\u0628\\u0631\\u0629.",noteElement:"\\u0639\\u0644\\u0649 \\u0627\\u0644\\u0639\\u0646\\u0635\\u0631",noteArea:"\\u0639\\u0644\\u0649 \\u0645\\u0646\\u0637\\u0642\\u0629",noteSelectElement:"\\u062D\\u062F\\u0651\\u062F \\u0639\\u0646\\u0635\\u0631\\u064B\\u0627 \\u0641\\u064A \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0623\\u0648\\u0644\\u064B\\u0627.",noteDrawArea:"\\u0627\\u0633\\u062D\\u0628 \\u0641\\u0648\\u0642 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0644\\u062A\\u062D\\u062F\\u064A\\u062F \\u0627\\u0644\\u0645\\u0646\\u0637\\u0642\\u0629.",noteAreaReady:"\\u0627\\u0644\\u0645\\u0646\\u0637\\u0642\\u0629 \\u0645\\u062D\\u062F\\u062F\\u0629. \\u064A\\u0645\\u0643\\u0646\\u0643 \\u0625\\u0636\\u0627\\u0641\\u062A\\u0647\\u0627 \\u0627\\u0644\\u0622\\u0646.",addNote:"\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0627\\u0644\\u0645\\u0644\\u0627\\u062D\\u0638\\u0629",addingNote:"\\u062A\\u064F\\u0636\\u0627\\u0641",doneNote:"\\u062A\\u0645\\u062A",noteOnSlide:e=>`\\u0639\\u0644\\u0649 \\u0634\\u0631\\u064A\\u062D\\u0629 ${Te(e,"ar")}`,noteAreaTarget:"\\u0645\\u0646\\u0637\\u0642\\u0629 \\u0645\\u062D\\u062F\\u062F\\u0629",noteElementTarget:e=>`\\u0639\\u0646\\u0635\\u0631 \\xB7 ${e}`,openNotes:"\\u0627\\u0644\\u0645\\u0644\\u0627\\u062D\\u0638\\u0627\\u062A \\u0627\\u0644\\u0645\\u0641\\u062A\\u0648\\u062D\\u0629",fihrisLabel:"\\u0641\\u0647\\u0631\\u0633 \\u0627\\u0644\\u0634\\u0631\\u0627\\u0626\\u062D",untitled:"\\u0628\\u0644\\u0627 \\u0639\\u0646\\u0648\\u0627\\u0646",addSlide:"\\u0634\\u0631\\u064A\\u062D\\u0629 \\u062C\\u062F\\u064A\\u062F\\u0629",addSlideLater:"\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0627\\u0644\\u0634\\u0631\\u0627\\u0626\\u062D \\u062A\\u0635\\u0644 \\u0645\\u0639 \\u0623\\u062F\\u0648\\u0627\\u062A \\u0627\\u0644\\u0625\\u062F\\u0631\\u0627\\u062C",chooseLayout:"\\u0627\\u062E\\u062A\\u0631 \\u062A\\u062E\\u0637\\u064A\\u0637 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",duplicateSlide:"\\u0646\\u0633\\u062E \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",deleteSlide:"\\u062D\\u0630\\u0641 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629",moveSlideBefore:"\\u062D\\u0631\\u0651\\u0643 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0625\\u0644\\u0649 \\u0627\\u0644\\u0633\\u0627\\u0628\\u0642",moveSlideAfter:"\\u062D\\u0631\\u0651\\u0643 \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0625\\u0644\\u0649 \\u0627\\u0644\\u062A\\u0627\\u0644\\u064A",fihrisCollapse:"\\u0635\\u063A\\u0651\\u0631 \\u0627\\u0644\\u0641\\u0647\\u0631\\u0633",fihrisExpand:"\\u0643\\u0628\\u0651\\u0631 \\u0627\\u0644\\u0641\\u0647\\u0631\\u0633",fihrisNumber:e=>Te(fr(e),"ar"),conflictTitle:"\\u062A\\u063A\\u064A\\u0651\\u0631 \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0642\\u0631\\u0635 \\u0648\\u0639\\u0646\\u062F\\u0643 \\u062A\\u0639\\u062F\\u064A\\u0644\\u0627\\u062A \\u0644\\u0645 \\u062A\\u064F\\u062D\\u0641\\u0638.",conflictBody:"\\u063A\\u0627\\u0644\\u0628\\u064B\\u0627 \\u0639\\u062F\\u0651\\u0644\\u0647 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644. \\u0627\\u062E\\u062A\\u0631 \\u0645\\u0627 \\u064A\\u0628\\u0642\\u0649 \\u0642\\u0628\\u0644 \\u0627\\u0644\\u062D\\u0641\\u0638.",conflictDeleted:"\\u0627\\u062E\\u062A\\u0641\\u0649 \\u0627\\u0644\\u0645\\u0644\\u0641 \\u0645\\u0646 \\u0645\\u0643\\u0627\\u0646\\u0647 \\u0623\\u0648 \\u062A\\u0639\\u0630\\u0651\\u0631\\u062A \\u0642\\u0631\\u0627\\u0621\\u062A\\u0647. \\u0623\\u0639\\u062F\\u0647 \\u062B\\u0645 \\u0627\\u062E\\u062A\\u0631 \\u0645\\u0627 \\u064A\\u0628\\u0642\\u0649.",saveRefused:"\\u0644\\u0645 \\u064A\\u064F\\u062D\\u0641\\u0638 \\u0634\\u064A\\u0621: \\u0627\\u062E\\u062A\\u0631 \\u0623\\u0648\\u0644\\u064B\\u0627 \\u0628\\u064A\\u0646 \\u0646\\u0633\\u062E\\u0629 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644 \\u0648\\u062A\\u0639\\u062F\\u064A\\u0644\\u0627\\u062A\\u0643.",acceptAgent:"\\u0627\\u0639\\u062A\\u0645\\u062F \\u0646\\u0633\\u062E\\u0629 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644",reapply:"\\u0623\\u0639\\u062F \\u062A\\u0637\\u0628\\u064A\\u0642 \\u062A\\u0639\\u062F\\u064A\\u0644\\u0627\\u062A\\u064A",resolvedReload:"\\u0627\\u0639\\u062A\\u064F\\u0645\\u062F\\u062A \\u0646\\u0633\\u062E\\u0629 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644.",resolvedOk:"\\u0623\\u064F\\u0639\\u064A\\u062F \\u062A\\u0637\\u0628\\u064A\\u0642 \\u062A\\u0639\\u062F\\u064A\\u0644\\u0627\\u062A\\u0643 \\u0639\\u0644\\u0649 \\u0646\\u0633\\u062E\\u0629 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644.",resolvedFailed:e=>`\\u0623\\u064F\\u0639\\u064A\\u062F \\u062A\\u0637\\u0628\\u064A\\u0642 \\u0627\\u0644\\u0628\\u0627\\u0642\\u064A\\u060C \\u0648\\u062A\\u0639\\u0630\\u0651\\u0631: ${e.join("\\u060C ")}`,notReplayable:"\\u062A\\u0631\\u0627\\u062C\\u0639\\u062A \\u0625\\u0644\\u0649 \\u0645\\u0627 \\u0642\\u0628\\u0644 \\u0622\\u062E\\u0631 \\u062D\\u0641\\u0638\\u060C \\u0641\\u0644\\u0627 \\u064A\\u0645\\u0643\\u0646 \\u0625\\u0639\\u0627\\u062F\\u0629 \\u062A\\u0637\\u0628\\u064A\\u0642 \\u062A\\u0639\\u062F\\u064A\\u0644\\u0627\\u062A\\u0643. \\u0627\\u0639\\u062A\\u0645\\u062F \\u0646\\u0633\\u062E\\u0629 \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644.",agentUpdated:"\\u062D\\u062F\\u0651\\u062B \\u0627\\u0644\\u0648\\u0643\\u064A\\u0644 \\u0627\\u0644\\u0645\\u0644\\u0641",dismiss:"\\u0625\\u063A\\u0644\\u0627\\u0642",requestFailed:e=>`\\u062A\\u0639\\u0630\\u0651\\u0631 \\u062A\\u0646\\u0641\\u064A\\u0630 \\u0627\\u0644\\u0637\\u0644\\u0628: ${e}`,reconnecting:"\\u0627\\u0646\\u0642\\u0637\\u0639 \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644 \\u0628\\u0627\\u0644\\u0645\\u062D\\u0631\\u0651\\u0631\\u060C \\u064A\\u0639\\u064A\\u062F \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644",lintAlpha:e=>`\\u0627\\u0644\\u0635\\u0646\\u0641 ${e} \\u0644\\u0627 \\u064A\\u0638\\u0647\\u0631 \\u0628\\u0627\\u0644\\u0634\\u0641\\u0627\\u0641\\u064A\\u0629 \\u0627\\u0644\\u0645\\u0643\\u062A\\u0648\\u0628\\u0629\\u060C \\u0644\\u0623\\u0646 \\u0644\\u0648\\u0646\\u0647 \\u0645\\u062A\\u063A\\u064A\\u0651\\u0631 \\u0641\\u064A \\u0647\\u0648\\u064A\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636.`,lintLetterSpacing:e=>`${e} \\u064A\\u0628\\u0627\\u0639\\u062F \\u0628\\u064A\\u0646 \\u062D\\u0631\\u0648\\u0641 \\u0639\\u0631\\u0628\\u064A\\u0629 \\u0641\\u064A\\u0642\\u0637\\u0639 \\u0627\\u062A\\u0635\\u0627\\u0644\\u0647\\u0627.`,lintMixedDigits:"\\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u062A\\u062E\\u0644\\u0637 \\u0627\\u0644\\u0623\\u0631\\u0642\\u0627\\u0645 \\u0627\\u0644\\u0639\\u0631\\u0628\\u064A\\u0629 \\u0628\\u0627\\u0644\\u063A\\u0631\\u0628\\u064A\\u0629.",lintMissingWeight:e=>`${e} \\u064A\\u0637\\u0644\\u0628 \\u0648\\u0632\\u0646\\u064B\\u0627 \\u063A\\u064A\\u0631 \\u0645\\u0648\\u062C\\u0648\\u062F \\u0641\\u064A \\u0645\\u0644\\u0641\\u0627\\u062A \\u0627\\u0644\\u062E\\u0637.`,lintMissingAsset:e=>`\\u0645\\u0644\\u0641 \\u063A\\u064A\\u0631 \\u0645\\u0648\\u062C\\u0648\\u062F: ${e}`,lintEmoji:"\\u0641\\u064A \\u0627\\u0644\\u0646\\u0635 \\u0631\\u0645\\u0632 \\u062A\\u0639\\u0628\\u064A\\u0631\\u064A\\u060C \\u0648\\u0627\\u0644\\u0639\\u0631\\u0636 \\u064A\\u0645\\u0646\\u0639\\u0647\\u0627.",lintSlideRelative:"\\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u062A\\u062D\\u0645\\u0644 \\u0627\\u0644\\u0635\\u0646\\u0641 relative \\u0641\\u062A\\u062E\\u0631\\u062C \\u0639\\u0646 \\u0645\\u0633\\u0631\\u062D \\u0627\\u0644\\u0639\\u0631\\u0636."},Ma={appName:"Nevermind",appSub:"Studio",documentTitle:e=>`${e} \\xB7 Nevermind Studio`,modesLabel:"Editor tools",modeEdit:"Edit",modeInsert:"Insert",modeMotion:"Motion",modeIdentity:"Identity",modeLater:"These tools arrive in a later update",saved:"Saved",unsaved:"Unsaved",linesWord:e=>e===1?"line":"lines",linesLabel:e=>`${e} ${e===1?"line differs":"lines differ"} from the saved file`,undo:"Undo",redo:"Redo",play:"Play the slide motion",pause:"Stop the motion and return to editing",langButton:"\\u0639",langSwitch:"\\u0627\\u0644\\u062A\\u0628\\u062F\\u064A\\u0644 \\u0625\\u0644\\u0649 \\u0627\\u0644\\u0639\\u0631\\u0628\\u064A\\u0629",save:"Save",saving:"Saving",savedToast:"File saved",canvasLabel:"Slide canvas",previewTitle:"Deck preview",zoomFit:"Fit to screen",zoomLabel:"Zoom",tabsLabel:"Element panel",tabProps:"Properties",tabLayers:"Layers",tabAgent:"For the agent",aiTitle:"Request a change to the selection",aiIntro:"Describe the result you want. The editor shows the source diff before applying anything.",aiSelect:"Select an element on the slide, then describe the change.",aiKind:"Agent request type",aiEditElement:"Edit element",aiRegenerateImage:"Regenerate image",aiPrompt:"Request",aiPlaceholder:"For example: shorten this title while keeping its tone.",aiImagePlaceholder:"Describe the new image, style, and composition.",aiSubmit:"Show the agent proposal",aiRunning:"The agent is working on an isolated copy\\u2026",aiReady:"The proposal is ready to review.",aiAccepted:"Proposal accepted. One Undo restores the previous source.",aiRejected:"Proposal rejected. The file was not changed.",exportOpen:"Export deck",exportTitle:"Export deck",exportIntro:"This exports what you see in the editor now, including unsaved changes. The deck file is not changed.",exportFormatLabel:"Export format",exportHtml:"Portable HTML file",exportHtmlHint:"One file that works offline, with images and fonts inside.",exportPdf:"PDF",exportPdfHint:"One 1920 x 1080 page per slide.",exportPng:"PNG images",exportPngHint:"One image per slide, in a ZIP when there are several.",exportPptx:"PowerPoint with slide images",exportPptxHint:"Each slide is one full image, with no editable text.",exportPptxEditable:"PowerPoint with editable text",exportPptxEditableHint:"Text becomes separate boxes over the background.",exportExperimental:"Experimental",exportAllowRemote:"Keep remote links (the file then needs the internet)",exportRun:"Export",exportRunning:"Exporting. This can take a minute.",exportReady:(e,t)=>`Ready: ${e} (${t} ${t===1?"slide":"slides"})`,exportDownload:"Download file",exportFailed:e=>`Export failed: ${e}`,exportClose:"Close",exportWarnTitle:"Before you share",exportFontWarn:"No licence was found next to the font:",exportFontNote:"Embedding a font does not give you the right to redistribute it. Check each font\'s licence before sharing.",exportRemoteWarn:e=>`${e} is a remote link, so the file needs the internet to work fully.`,exportExperimentalWarn:"Editable export is experimental: text boxes are measured from the rendered slide, and fonts must be installed on the viewing machine.",aiFailed:e=>`Could not prepare the proposal: ${e}`,aiDiff:"Diff before acceptance",aiReject:"Reject",aiAccept:"Accept change",roleMainTitle:"Main title",roleHeading:"Heading",roleText:"Text",roleImage:"Image",roleFigure:"Figure",roleGroup:"Group",roleShape:"Shape",roleSlide:"Slide",slideN:e=>`Slide ${e}`,breadcrumbLabel:"Element path",noSelection:"Click an element on the slide to see its properties. Double-click goes into a group; Esc goes back out.",sizeUnit:"px \\xB7 size",sizeLabel:"Font size",typoMixed:"Lines with different styles; edits apply to all of them",fontFamily:"Font family",weightLabel:"Font weight",weightLight:"Light",weightRegular:"Regular",weightBold:"Bold",weightBlack:"Black",textColour:"Text colour",fillColour:"Fill colour",colourFromDeck:e=>`From the deck identity \\xB7 ${e}`,colourOutside:e=>`Outside the deck identity \\xB7 ${e}`,deckColours:"Deck identity colours",lineHeight:"Line height",lineHeightNormal:"Normal",opacity:"Opacity",positionLabel:"Position and size",fromRight:"From right",fromLeft:"From left",fromTop:"From top",fromBottom:"From bottom",width:"Width",height:"Height",inFlow:"Follows its container\\u2019s layout",freePosition:"Free position",spacing:"Spacing",padding:"Padding",margin:"Margin",radius:"Corner radius",shadow:"Shadow",shadowNone:"No shadow",borderWidth:"Border width",borderColour:"Border colour",imageFit:"Image crop",imageCover:"Fill frame",imageContain:"Show all",focalX:"Horizontal focal point",focalY:"Vertical focal point",replaceImage:"Replace image",morphLinked:"Linked by Morph",morphWith:e=>`with ${e.map(t=>`slide ${t}`).join(", ")}`,issuesLabel:"Warnings",layersEmpty:"This slide has no elements.",layersLabel:"Slide layers",layerUp:"Move layer up",layerDown:"Move layer down",layerHide:"Hide layer",layerShow:"Show layer",agentEmpty:"No open notes. Select an element or draw an area, then tell the agent what you need.",agentIntro:"Pin work you do not want to do by hand; the agent receives the slide and element context.",noteText:"Note for the agent",notePlaceholder:"For example: shorten this title while keeping its tone.",noteElement:"On element",noteArea:"On area",noteSelectElement:"Select an element on the slide first.",noteDrawArea:"Drag across the slide to mark the area.",noteAreaReady:"The area is marked. You can add the note now.",addNote:"Add note",addingNote:"Adding",doneNote:"Done",noteOnSlide:e=>`On slide ${e}`,noteAreaTarget:"Marked area",noteElementTarget:e=>`Element \\xB7 ${e}`,openNotes:"Open notes",fihrisLabel:"Slide contents",untitled:"Untitled",addSlide:"New slide",addSlideLater:"Adding slides arrives with the insert tools",chooseLayout:"Choose a slide layout",duplicateSlide:"Duplicate slide",deleteSlide:"Delete slide",moveSlideBefore:"Move slide earlier",moveSlideAfter:"Move slide later",fihrisCollapse:"Collapse the contents",fihrisExpand:"Expand the contents",fihrisNumber:e=>fr(e),conflictTitle:"The file changed on disk while you have unsaved edits.",conflictBody:"The agent most likely edited it. Choose what stays before saving.",conflictDeleted:"The file is gone from its place or cannot be read. Put it back, then choose what stays.",saveRefused:"Nothing was saved: first choose between the agent\\u2019s version and your edits.",acceptAgent:"Keep the agent\\u2019s version",reapply:"Reapply my edits",resolvedReload:"The agent\\u2019s version is now open.",resolvedOk:"Your edits were reapplied on top of the agent\\u2019s version.",resolvedFailed:e=>`The rest was reapplied; these could not be: ${e.join(", ")}`,notReplayable:"You undid past the last save, so your edits cannot be reapplied. Keep the agent\\u2019s version.",agentUpdated:"The agent updated the file",dismiss:"Dismiss",requestFailed:e=>`The request failed: ${e}`,reconnecting:"Lost the connection to the editor; reconnecting",lintAlpha:e=>`${e} does not show its opacity, because its colour is a variable in the deck identity.`,lintLetterSpacing:e=>`${e} spaces out Arabic letters and breaks their joins.`,lintMixedDigits:"This slide mixes Arabic-Indic and Western digits.",lintMissingWeight:e=>`${e} asks for a weight the font files do not have.`,lintMissingAsset:e=>`Missing file: ${e}`,lintEmoji:"The text contains an emoji, which the deck rules forbid.",lintSlideRelative:"The slide has the class relative, which takes it off the deck stage."},Er={ar:Pa,en:Ma},mr={bone:"\\u0639\\u0638\\u0645\\u064A",cream:"\\u0643\\u0631\\u064A\\u0645\\u064A",ink:"\\u062D\\u0628\\u0631\\u064A",muted:"\\u0631\\u0645\\u0627\\u062F\\u064A \\u062E\\u0627\\u0641\\u062A",navy:"\\u0643\\u062D\\u0644\\u064A",blue:"\\u0623\\u0632\\u0631\\u0642",verm:"\\u0642\\u0631\\u0645\\u0632\\u064A",line:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u062E\\u0637\\u0648\\u0637",accent:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u062A\\u0645\\u064A\\u064A\\u0632",page:"\\u0644\\u0648\\u0646 \\u0627\\u0644\\u0635\\u0641\\u062D\\u0629",outer:"\\u0627\\u0644\\u062E\\u0644\\u0641\\u064A\\u0629",white:"\\u0623\\u0628\\u064A\\u0636",black:"\\u0623\\u0633\\u0648\\u062F",red:"\\u0623\\u062D\\u0645\\u0631",green:"\\u0623\\u062E\\u0636\\u0631",mint:"\\u0646\\u0639\\u0646\\u0627\\u0639\\u064A",lavender:"\\u062E\\u0632\\u0627\\u0645\\u064A",pink:"\\u0648\\u0631\\u062F\\u064A",sky:"\\u0633\\u0645\\u0627\\u0648\\u064A",paper:"\\u0648\\u0631\\u0642\\u064A"};function Ot(e,t){if(t==="en")return e;let n=e.split("-"),i=mr[n[n.length-1]];return mr[e]??i??e}var wa={"thmanyah serif display":"\\u062B\\u0645\\u0627\\u0646\\u064A\\u0629 \\u0633\\u064A\\u0631\\u064A\\u0641 \\u062F\\u064A\\u0633\\u0628\\u0644\\u064A","thmanyah display":"\\u062B\\u0645\\u0627\\u0646\\u064A\\u0629 \\u062F\\u064A\\u0633\\u0628\\u0644\\u064A","thmanyah serif text":"\\u062B\\u0645\\u0627\\u0646\\u064A\\u0629 \\u0633\\u064A\\u0631\\u064A\\u0641 \\u0646\\u0635","thmanyah sans":"\\u062B\\u0645\\u0627\\u0646\\u064A\\u0629 \\u0633\\u0627\\u0646\\u0633",komission:"\\u0643\\u0648\\u0645\\u0634\\u0646","ibm plex sans arabic":"\\u0622\\u064A \\u0628\\u064A \\u0625\\u0645 \\u0628\\u0644\\u0643\\u0633 \\u0639\\u0631\\u0628\\u064A","zain rounded":"\\u0632\\u064A\\u0646 \\u0627\\u0644\\u0645\\u062F\\u0648\\u0651\\u0631","readex pro":"\\u0631\\u064A\\u062F\\u0643\\u0633 \\u0628\\u0631\\u0648","qahwa arabic":"\\u0642\\u0647\\u0648\\u0629","alkhalil kufi":"\\u0627\\u0644\\u062E\\u0644\\u064A\\u0644 \\u0643\\u0648\\u0641\\u064A"};function Tr(e,t){let n=e.replace(/^[\'"]|[\'"]$/g,"").trim();return t==="ar"?wa[n.toLowerCase()]??n:n}var te=N("ar"),B=Be(()=>Er[te.value]),oe=N(0),le=N(null),ne=N({dirty:!1,changedLines:0,canUndo:!1,canRedo:!1}),Oe=N([]),ce=N(null),ge=N({version:1,notes:[]}),D=N(0),He=N("edit"),R=N(null),w=N([]),ie=N(null),Fe=N("fit"),dt=N(.4),j=Be(()=>Fe.value==="fit"?dt.value:Fe.value),Ve=N(0),ke=()=>{Ve.value++},q=N("props"),ae=N(!1),Ae=N(null),kt=N("element"),re=N(null),_e=N(!1),Ue=N(!1),je=N(!0),be=N(!1),un=N({}),Ce=N(!1),se=N(null),Re=N(null),Le=Be(()=>le.value?.slides.length??0);function qe(e){return le.value?.slides[e]?.title?.trim()||un.value[e]||null}var ve=N(!1);var Rt=null,Ba=null;function gr(e){Rt=e}function de(){try{return Rt?.contentWindow?.__nm??null}catch{return null}}var _r=()=>de()?Rt?.contentDocument??null:null,pt=()=>de()?Rt?.contentWindow??null:null,Fa=e=>`[data-nm-key="${e.replace(/[^a-z0-9]/gi,"")}"]`,L=e=>e?_r()?.querySelector(Fa(e))??null:null;function De(e){return e.getBoundingClientRect()}function pn(e){de()?.goTo(e),ke()}function Ha(){let e=_r();if(!e)return;let t={};e.querySelectorAll(".slide").forEach((n,i)=>{let s=(n.querySelector(\'h1, h2, h3, [class*="font-display"]\')?.textContent??"").replace(/\\s+/g," ").trim();s&&(t[i]=s.slice(0,80))}),un.value=t}function hn(){let e=Rt;if(!e)return Promise.reject(new Error("preview frame not mounted"));let t=new Promise(n=>{let i=()=>{e.removeEventListener("load",i);let a=e.contentDocument,s=a?.querySelector(\'meta[name="nm-version"]\');pn(D.value),Ha(),a?.fonts?.ready.then(ke,()=>{}),n(s?Number(s.getAttribute("content")):0)};e.addEventListener("load",i),e.src=ur()});return Ba=t.then(()=>{}),t}function Ua(e,t,n){return t.version<=e||t.origin!==void 0&&t.origin===n?"skip":t.version===e+1&&Array.isArray(t.previewPatch)&&!t.stale?"patch":"reload"}var za=(e,t)=>e>0&&t>e?"reload":"skip",fn=new Set;function xr(e){return fn.add(e),()=>{fn.delete(e)}}var br=Promise.resolve();function ze(e){let t=br.then(e,e);return br=t.catch(()=>{}),t}function Ar(e){typeof e.dirty=="boolean"&&(ne.value={dirty:e.dirty,changedLines:e.changedLines??(e.dirty?Math.max(1,ne.value.changedLines):0),canUndo:!!e.canUndo,canRedo:!!e.canRedo})}function vr(){R.value&&!L(R.value)&&(R.value=null),w.value=w.value.filter(e=>!!L(e)),R.value&&!w.value.includes(R.value)&&(w.value=[R.value]),ie.value&&!L(ie.value)&&(ie.value=null),ke()}async function yr(e){let t=await hn();oe.value=Math.max(t,oe.value),vr();for(let n of fn)n("reloaded",e);return Lt(),"reloaded"}function Dt(e){return ze(async()=>{let t=Ua(oe.value,e,ut);if(t==="skip")return"skipped";if(Ar(e),t==="patch"){let n=de();if((n?n.applyPatch(e.previewPatch):["no-layer"]).length===0){oe.value=e.version,vr();for(let a of fn)a("patched",e);return Lt(),"patched"}}return oe.value=e.version,yr(e)})}function Zn(){return ze(()=>yr({version:oe.value,previewPatch:"reload"}))}var mn=null,Jn=0;async function ye(){let e=await P.state();e.version<Jn||(Jn=e.version,le.value=e.info,Oe.value=e.lint,ge.value=e.notes,ce.value=e.conflict,Ar(e))}async function Cr(){Jn<oe.value&&await ye()}function Lt(e=120){mn&&clearTimeout(mn),mn=setTimeout(()=>{mn=null,ye().catch(()=>{})},e)}var ei=[];function Sr(){let e=new EventSource(Qe("/api/events")),t=(n,i)=>e.addEventListener(n,a=>{let s=JSON.parse(a.data);ei.push({event:n,data:s}),i(s)});return e.addEventListener("open",()=>{je.value=!0}),e.addEventListener("error",()=>{je.value=!1}),t("hello",n=>{je.value=!0,za(oe.value,n.version)==="reload"&&Zn().catch(()=>{}),Lt(0)}),t("version",n=>{n.origin!==ut&&Dt(n).catch(()=>{})}),t("saved",n=>{ne.value={...ne.value,dirty:n.dirty,changedLines:n.changedLines??(n.dirty?ne.value.changedLines:0)},Lt()}),t("disk-changed",n=>{n.conflict?ce.value={diskFingerprint:n.diskFingerprint??"",...n.deleted?{deleted:!0}:{}}:ce.value=null,n.reloaded&&!n.resolved&&(Re.value="agentUpdated"),Lt()}),t("lint",n=>{Oe.value=n.issues}),t("notes",n=>{ge.value=n.notes}),e}var Pt;(function(e){e[e.EOF=-1]="EOF",e[e.NULL=0]="NULL",e[e.TABULATION=9]="TABULATION",e[e.CARRIAGE_RETURN=13]="CARRIAGE_RETURN",e[e.LINE_FEED=10]="LINE_FEED",e[e.FORM_FEED=12]="FORM_FEED",e[e.SPACE=32]="SPACE",e[e.EXCLAMATION_MARK=33]="EXCLAMATION_MARK",e[e.QUOTATION_MARK=34]="QUOTATION_MARK",e[e.AMPERSAND=38]="AMPERSAND",e[e.APOSTROPHE=39]="APOSTROPHE",e[e.HYPHEN_MINUS=45]="HYPHEN_MINUS",e[e.SOLIDUS=47]="SOLIDUS",e[e.DIGIT_0=48]="DIGIT_0",e[e.DIGIT_9=57]="DIGIT_9",e[e.SEMICOLON=59]="SEMICOLON",e[e.LESS_THAN_SIGN=60]="LESS_THAN_SIGN",e[e.EQUALS_SIGN=61]="EQUALS_SIGN",e[e.GREATER_THAN_SIGN=62]="GREATER_THAN_SIGN",e[e.QUESTION_MARK=63]="QUESTION_MARK",e[e.LATIN_CAPITAL_A=65]="LATIN_CAPITAL_A",e[e.LATIN_CAPITAL_Z=90]="LATIN_CAPITAL_Z",e[e.RIGHT_SQUARE_BRACKET=93]="RIGHT_SQUARE_BRACKET",e[e.GRAVE_ACCENT=96]="GRAVE_ACCENT",e[e.LATIN_SMALL_A=97]="LATIN_SMALL_A",e[e.LATIN_SMALL_Z=122]="LATIN_SMALL_Z"})(Pt||(Pt={}));var ht;(function(e){e.controlCharacterInInputStream="control-character-in-input-stream",e.noncharacterInInputStream="noncharacter-in-input-stream",e.surrogateInInputStream="surrogate-in-input-stream",e.nonVoidHtmlElementStartTagWithTrailingSolidus="non-void-html-element-start-tag-with-trailing-solidus",e.endTagWithAttributes="end-tag-with-attributes",e.endTagWithTrailingSolidus="end-tag-with-trailing-solidus",e.unexpectedSolidusInTag="unexpected-solidus-in-tag",e.unexpectedNullCharacter="unexpected-null-character",e.unexpectedQuestionMarkInsteadOfTagName="unexpected-question-mark-instead-of-tag-name",e.invalidFirstCharacterOfTagName="invalid-first-character-of-tag-name",e.unexpectedEqualsSignBeforeAttributeName="unexpected-equals-sign-before-attribute-name",e.missingEndTagName="missing-end-tag-name",e.unexpectedCharacterInAttributeName="unexpected-character-in-attribute-name",e.unknownNamedCharacterReference="unknown-named-character-reference",e.missingSemicolonAfterCharacterReference="missing-semicolon-after-character-reference",e.unexpectedCharacterAfterDoctypeSystemIdentifier="unexpected-character-after-doctype-system-identifier",e.unexpectedCharacterInUnquotedAttributeValue="unexpected-character-in-unquoted-attribute-value",e.eofBeforeTagName="eof-before-tag-name",e.eofInTag="eof-in-tag",e.missingAttributeValue="missing-attribute-value",e.missingWhitespaceBetweenAttributes="missing-whitespace-between-attributes",e.missingWhitespaceAfterDoctypePublicKeyword="missing-whitespace-after-doctype-public-keyword",e.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers="missing-whitespace-between-doctype-public-and-system-identifiers",e.missingWhitespaceAfterDoctypeSystemKeyword="missing-whitespace-after-doctype-system-keyword",e.missingQuoteBeforeDoctypePublicIdentifier="missing-quote-before-doctype-public-identifier",e.missingQuoteBeforeDoctypeSystemIdentifier="missing-quote-before-doctype-system-identifier",e.missingDoctypePublicIdentifier="missing-doctype-public-identifier",e.missingDoctypeSystemIdentifier="missing-doctype-system-identifier",e.abruptDoctypePublicIdentifier="abrupt-doctype-public-identifier",e.abruptDoctypeSystemIdentifier="abrupt-doctype-system-identifier",e.cdataInHtmlContent="cdata-in-html-content",e.incorrectlyOpenedComment="incorrectly-opened-comment",e.eofInScriptHtmlCommentLikeText="eof-in-script-html-comment-like-text",e.eofInDoctype="eof-in-doctype",e.nestedComment="nested-comment",e.abruptClosingOfEmptyComment="abrupt-closing-of-empty-comment",e.eofInComment="eof-in-comment",e.incorrectlyClosedComment="incorrectly-closed-comment",e.eofInCdata="eof-in-cdata",e.absenceOfDigitsInNumericCharacterReference="absence-of-digits-in-numeric-character-reference",e.nullCharacterReference="null-character-reference",e.surrogateCharacterReference="surrogate-character-reference",e.characterReferenceOutsideUnicodeRange="character-reference-outside-unicode-range",e.controlCharacterReference="control-character-reference",e.noncharacterCharacterReference="noncharacter-character-reference",e.missingWhitespaceBeforeDoctypeName="missing-whitespace-before-doctype-name",e.missingDoctypeName="missing-doctype-name",e.invalidCharacterSequenceAfterDoctypeName="invalid-character-sequence-after-doctype-name",e.duplicateAttribute="duplicate-attribute",e.nonConformingDoctype="non-conforming-doctype",e.missingDoctype="missing-doctype",e.misplacedDoctype="misplaced-doctype",e.endTagWithoutMatchingOpenElement="end-tag-without-matching-open-element",e.closingOfElementWithOpenChildElements="closing-of-element-with-open-child-elements",e.disallowedContentInNoscriptInHead="disallowed-content-in-noscript-in-head",e.openElementsLeftAfterEof="open-elements-left-after-eof",e.abandonedHeadElementChild="abandoned-head-element-child",e.misplacedStartTagForHeadElement="misplaced-start-tag-for-head-element",e.nestedNoscriptInHead="nested-noscript-in-head",e.eofInElementThatCanContainOnlyText="eof-in-element-that-can-contain-only-text"})(ht||(ht={}));var En;(function(e){e[e.CHARACTER=0]="CHARACTER",e[e.NULL_CHARACTER=1]="NULL_CHARACTER",e[e.WHITESPACE_CHARACTER=2]="WHITESPACE_CHARACTER",e[e.START_TAG=3]="START_TAG",e[e.END_TAG=4]="END_TAG",e[e.COMMENT=5]="COMMENT",e[e.DOCTYPE=6]="DOCTYPE",e[e.EOF=7]="EOF",e[e.HIBERNATION=8]="HIBERNATION"})(En||(En={}));var U;(function(e){e.HTML="http://www.w3.org/1999/xhtml",e.MATHML="http://www.w3.org/1998/Math/MathML",e.SVG="http://www.w3.org/2000/svg",e.XLINK="http://www.w3.org/1999/xlink",e.XML="http://www.w3.org/XML/1998/namespace",e.XMLNS="http://www.w3.org/2000/xmlns/"})(U||(U={}));var Tn;(function(e){e.TYPE="type",e.ACTION="action",e.ENCODING="encoding",e.PROMPT="prompt",e.NAME="name",e.COLOR="color",e.FACE="face",e.SIZE="size"})(Tn||(Tn={}));var Mt;(function(e){e.NO_QUIRKS="no-quirks",e.QUIRKS="quirks",e.LIMITED_QUIRKS="limited-quirks"})(Mt||(Mt={}));var p;(function(e){e.A="a",e.ADDRESS="address",e.ANNOTATION_XML="annotation-xml",e.APPLET="applet",e.AREA="area",e.ARTICLE="article",e.ASIDE="aside",e.B="b",e.BASE="base",e.BASEFONT="basefont",e.BGSOUND="bgsound",e.BIG="big",e.BLOCKQUOTE="blockquote",e.BODY="body",e.BR="br",e.BUTTON="button",e.CAPTION="caption",e.CENTER="center",e.CODE="code",e.COL="col",e.COLGROUP="colgroup",e.DD="dd",e.DESC="desc",e.DETAILS="details",e.DIALOG="dialog",e.DIR="dir",e.DIV="div",e.DL="dl",e.DT="dt",e.EM="em",e.EMBED="embed",e.FIELDSET="fieldset",e.FIGCAPTION="figcaption",e.FIGURE="figure",e.FONT="font",e.FOOTER="footer",e.FOREIGN_OBJECT="foreignObject",e.FORM="form",e.FRAME="frame",e.FRAMESET="frameset",e.H1="h1",e.H2="h2",e.H3="h3",e.H4="h4",e.H5="h5",e.H6="h6",e.HEAD="head",e.HEADER="header",e.HGROUP="hgroup",e.HR="hr",e.HTML="html",e.I="i",e.IMG="img",e.IMAGE="image",e.INPUT="input",e.IFRAME="iframe",e.KEYGEN="keygen",e.LABEL="label",e.LI="li",e.LINK="link",e.LISTING="listing",e.MAIN="main",e.MALIGNMARK="malignmark",e.MARQUEE="marquee",e.MATH="math",e.MENU="menu",e.META="meta",e.MGLYPH="mglyph",e.MI="mi",e.MO="mo",e.MN="mn",e.MS="ms",e.MTEXT="mtext",e.NAV="nav",e.NOBR="nobr",e.NOFRAMES="noframes",e.NOEMBED="noembed",e.NOSCRIPT="noscript",e.OBJECT="object",e.OL="ol",e.OPTGROUP="optgroup",e.OPTION="option",e.P="p",e.PARAM="param",e.PLAINTEXT="plaintext",e.PRE="pre",e.RB="rb",e.RP="rp",e.RT="rt",e.RTC="rtc",e.RUBY="ruby",e.S="s",e.SCRIPT="script",e.SEARCH="search",e.SECTION="section",e.SELECT="select",e.SOURCE="source",e.SMALL="small",e.SPAN="span",e.STRIKE="strike",e.STRONG="strong",e.STYLE="style",e.SUB="sub",e.SUMMARY="summary",e.SUP="sup",e.TABLE="table",e.TBODY="tbody",e.TEMPLATE="template",e.TEXTAREA="textarea",e.TFOOT="tfoot",e.TD="td",e.TH="th",e.THEAD="thead",e.TITLE="title",e.TR="tr",e.TRACK="track",e.TT="tt",e.U="u",e.UL="ul",e.SVG="svg",e.VAR="var",e.WBR="wbr",e.XMP="xmp"})(p||(p={}));var l;(function(e){e[e.UNKNOWN=0]="UNKNOWN",e[e.A=1]="A",e[e.ADDRESS=2]="ADDRESS",e[e.ANNOTATION_XML=3]="ANNOTATION_XML",e[e.APPLET=4]="APPLET",e[e.AREA=5]="AREA",e[e.ARTICLE=6]="ARTICLE",e[e.ASIDE=7]="ASIDE",e[e.B=8]="B",e[e.BASE=9]="BASE",e[e.BASEFONT=10]="BASEFONT",e[e.BGSOUND=11]="BGSOUND",e[e.BIG=12]="BIG",e[e.BLOCKQUOTE=13]="BLOCKQUOTE",e[e.BODY=14]="BODY",e[e.BR=15]="BR",e[e.BUTTON=16]="BUTTON",e[e.CAPTION=17]="CAPTION",e[e.CENTER=18]="CENTER",e[e.CODE=19]="CODE",e[e.COL=20]="COL",e[e.COLGROUP=21]="COLGROUP",e[e.DD=22]="DD",e[e.DESC=23]="DESC",e[e.DETAILS=24]="DETAILS",e[e.DIALOG=25]="DIALOG",e[e.DIR=26]="DIR",e[e.DIV=27]="DIV",e[e.DL=28]="DL",e[e.DT=29]="DT",e[e.EM=30]="EM",e[e.EMBED=31]="EMBED",e[e.FIELDSET=32]="FIELDSET",e[e.FIGCAPTION=33]="FIGCAPTION",e[e.FIGURE=34]="FIGURE",e[e.FONT=35]="FONT",e[e.FOOTER=36]="FOOTER",e[e.FOREIGN_OBJECT=37]="FOREIGN_OBJECT",e[e.FORM=38]="FORM",e[e.FRAME=39]="FRAME",e[e.FRAMESET=40]="FRAMESET",e[e.H1=41]="H1",e[e.H2=42]="H2",e[e.H3=43]="H3",e[e.H4=44]="H4",e[e.H5=45]="H5",e[e.H6=46]="H6",e[e.HEAD=47]="HEAD",e[e.HEADER=48]="HEADER",e[e.HGROUP=49]="HGROUP",e[e.HR=50]="HR",e[e.HTML=51]="HTML",e[e.I=52]="I",e[e.IMG=53]="IMG",e[e.IMAGE=54]="IMAGE",e[e.INPUT=55]="INPUT",e[e.IFRAME=56]="IFRAME",e[e.KEYGEN=57]="KEYGEN",e[e.LABEL=58]="LABEL",e[e.LI=59]="LI",e[e.LINK=60]="LINK",e[e.LISTING=61]="LISTING",e[e.MAIN=62]="MAIN",e[e.MALIGNMARK=63]="MALIGNMARK",e[e.MARQUEE=64]="MARQUEE",e[e.MATH=65]="MATH",e[e.MENU=66]="MENU",e[e.META=67]="META",e[e.MGLYPH=68]="MGLYPH",e[e.MI=69]="MI",e[e.MO=70]="MO",e[e.MN=71]="MN",e[e.MS=72]="MS",e[e.MTEXT=73]="MTEXT",e[e.NAV=74]="NAV",e[e.NOBR=75]="NOBR",e[e.NOFRAMES=76]="NOFRAMES",e[e.NOEMBED=77]="NOEMBED",e[e.NOSCRIPT=78]="NOSCRIPT",e[e.OBJECT=79]="OBJECT",e[e.OL=80]="OL",e[e.OPTGROUP=81]="OPTGROUP",e[e.OPTION=82]="OPTION",e[e.P=83]="P",e[e.PARAM=84]="PARAM",e[e.PLAINTEXT=85]="PLAINTEXT",e[e.PRE=86]="PRE",e[e.RB=87]="RB",e[e.RP=88]="RP",e[e.RT=89]="RT",e[e.RTC=90]="RTC",e[e.RUBY=91]="RUBY",e[e.S=92]="S",e[e.SCRIPT=93]="SCRIPT",e[e.SEARCH=94]="SEARCH",e[e.SECTION=95]="SECTION",e[e.SELECT=96]="SELECT",e[e.SOURCE=97]="SOURCE",e[e.SMALL=98]="SMALL",e[e.SPAN=99]="SPAN",e[e.STRIKE=100]="STRIKE",e[e.STRONG=101]="STRONG",e[e.STYLE=102]="STYLE",e[e.SUB=103]="SUB",e[e.SUMMARY=104]="SUMMARY",e[e.SUP=105]="SUP",e[e.TABLE=106]="TABLE",e[e.TBODY=107]="TBODY",e[e.TEMPLATE=108]="TEMPLATE",e[e.TEXTAREA=109]="TEXTAREA",e[e.TFOOT=110]="TFOOT",e[e.TD=111]="TD",e[e.TH=112]="TH",e[e.THEAD=113]="THEAD",e[e.TITLE=114]="TITLE",e[e.TR=115]="TR",e[e.TRACK=116]="TRACK",e[e.TT=117]="TT",e[e.U=118]="U",e[e.UL=119]="UL",e[e.SVG=120]="SVG",e[e.VAR=121]="VAR",e[e.WBR=122]="WBR",e[e.XMP=123]="XMP"})(l||(l={}));var Yl=new Map([[p.A,l.A],[p.ADDRESS,l.ADDRESS],[p.ANNOTATION_XML,l.ANNOTATION_XML],[p.APPLET,l.APPLET],[p.AREA,l.AREA],[p.ARTICLE,l.ARTICLE],[p.ASIDE,l.ASIDE],[p.B,l.B],[p.BASE,l.BASE],[p.BASEFONT,l.BASEFONT],[p.BGSOUND,l.BGSOUND],[p.BIG,l.BIG],[p.BLOCKQUOTE,l.BLOCKQUOTE],[p.BODY,l.BODY],[p.BR,l.BR],[p.BUTTON,l.BUTTON],[p.CAPTION,l.CAPTION],[p.CENTER,l.CENTER],[p.CODE,l.CODE],[p.COL,l.COL],[p.COLGROUP,l.COLGROUP],[p.DD,l.DD],[p.DESC,l.DESC],[p.DETAILS,l.DETAILS],[p.DIALOG,l.DIALOG],[p.DIR,l.DIR],[p.DIV,l.DIV],[p.DL,l.DL],[p.DT,l.DT],[p.EM,l.EM],[p.EMBED,l.EMBED],[p.FIELDSET,l.FIELDSET],[p.FIGCAPTION,l.FIGCAPTION],[p.FIGURE,l.FIGURE],[p.FONT,l.FONT],[p.FOOTER,l.FOOTER],[p.FOREIGN_OBJECT,l.FOREIGN_OBJECT],[p.FORM,l.FORM],[p.FRAME,l.FRAME],[p.FRAMESET,l.FRAMESET],[p.H1,l.H1],[p.H2,l.H2],[p.H3,l.H3],[p.H4,l.H4],[p.H5,l.H5],[p.H6,l.H6],[p.HEAD,l.HEAD],[p.HEADER,l.HEADER],[p.HGROUP,l.HGROUP],[p.HR,l.HR],[p.HTML,l.HTML],[p.I,l.I],[p.IMG,l.IMG],[p.IMAGE,l.IMAGE],[p.INPUT,l.INPUT],[p.IFRAME,l.IFRAME],[p.KEYGEN,l.KEYGEN],[p.LABEL,l.LABEL],[p.LI,l.LI],[p.LINK,l.LINK],[p.LISTING,l.LISTING],[p.MAIN,l.MAIN],[p.MALIGNMARK,l.MALIGNMARK],[p.MARQUEE,l.MARQUEE],[p.MATH,l.MATH],[p.MENU,l.MENU],[p.META,l.META],[p.MGLYPH,l.MGLYPH],[p.MI,l.MI],[p.MO,l.MO],[p.MN,l.MN],[p.MS,l.MS],[p.MTEXT,l.MTEXT],[p.NAV,l.NAV],[p.NOBR,l.NOBR],[p.NOFRAMES,l.NOFRAMES],[p.NOEMBED,l.NOEMBED],[p.NOSCRIPT,l.NOSCRIPT],[p.OBJECT,l.OBJECT],[p.OL,l.OL],[p.OPTGROUP,l.OPTGROUP],[p.OPTION,l.OPTION],[p.P,l.P],[p.PARAM,l.PARAM],[p.PLAINTEXT,l.PLAINTEXT],[p.PRE,l.PRE],[p.RB,l.RB],[p.RP,l.RP],[p.RT,l.RT],[p.RTC,l.RTC],[p.RUBY,l.RUBY],[p.S,l.S],[p.SCRIPT,l.SCRIPT],[p.SEARCH,l.SEARCH],[p.SECTION,l.SECTION],[p.SELECT,l.SELECT],[p.SOURCE,l.SOURCE],[p.SMALL,l.SMALL],[p.SPAN,l.SPAN],[p.STRIKE,l.STRIKE],[p.STRONG,l.STRONG],[p.STYLE,l.STYLE],[p.SUB,l.SUB],[p.SUMMARY,l.SUMMARY],[p.SUP,l.SUP],[p.TABLE,l.TABLE],[p.TBODY,l.TBODY],[p.TEMPLATE,l.TEMPLATE],[p.TEXTAREA,l.TEXTAREA],[p.TFOOT,l.TFOOT],[p.TD,l.TD],[p.TH,l.TH],[p.THEAD,l.THEAD],[p.TITLE,l.TITLE],[p.TR,l.TR],[p.TRACK,l.TRACK],[p.TT,l.TT],[p.U,l.U],[p.UL,l.UL],[p.SVG,l.SVG],[p.VAR,l.VAR],[p.WBR,l.WBR],[p.XMP,l.XMP]]);var g=l,ti={[U.HTML]:new Set([g.ADDRESS,g.APPLET,g.AREA,g.ARTICLE,g.ASIDE,g.BASE,g.BASEFONT,g.BGSOUND,g.BLOCKQUOTE,g.BODY,g.BR,g.BUTTON,g.CAPTION,g.CENTER,g.COL,g.COLGROUP,g.DD,g.DETAILS,g.DIR,g.DIV,g.DL,g.DT,g.EMBED,g.FIELDSET,g.FIGCAPTION,g.FIGURE,g.FOOTER,g.FORM,g.FRAME,g.FRAMESET,g.H1,g.H2,g.H3,g.H4,g.H5,g.H6,g.HEAD,g.HEADER,g.HGROUP,g.HR,g.HTML,g.IFRAME,g.IMG,g.INPUT,g.LI,g.LINK,g.LISTING,g.MAIN,g.MARQUEE,g.MENU,g.META,g.NAV,g.NOEMBED,g.NOFRAMES,g.NOSCRIPT,g.OBJECT,g.OL,g.P,g.PARAM,g.PLAINTEXT,g.PRE,g.SCRIPT,g.SECTION,g.SELECT,g.SOURCE,g.STYLE,g.SUMMARY,g.TABLE,g.TBODY,g.TD,g.TEMPLATE,g.TEXTAREA,g.TFOOT,g.TH,g.THEAD,g.TITLE,g.TR,g.TRACK,g.UL,g.WBR,g.XMP]),[U.MATHML]:new Set([g.MI,g.MO,g.MN,g.MS,g.MTEXT,g.ANNOTATION_XML]),[U.SVG]:new Set([g.TITLE,g.FOREIGN_OBJECT,g.DESC]),[U.XLINK]:new Set,[U.XML]:new Set,[U.XMLNS]:new Set},Xa=new Set([g.H1,g.H2,g.H3,g.H4,g.H5,g.H6]),$l=new Set([p.STYLE,p.SCRIPT,p.XMP,p.IFRAME,p.NOEMBED,p.NOFRAMES,p.PLAINTEXT]);var Ye;(function(e){e[e.DATA=0]="DATA",e[e.RCDATA=1]="RCDATA",e[e.RAWTEXT=2]="RAWTEXT",e[e.SCRIPT_DATA=3]="SCRIPT_DATA",e[e.PLAINTEXT=4]="PLAINTEXT",e[e.TAG_OPEN=5]="TAG_OPEN",e[e.END_TAG_OPEN=6]="END_TAG_OPEN",e[e.TAG_NAME=7]="TAG_NAME",e[e.RCDATA_LESS_THAN_SIGN=8]="RCDATA_LESS_THAN_SIGN",e[e.RCDATA_END_TAG_OPEN=9]="RCDATA_END_TAG_OPEN",e[e.RCDATA_END_TAG_NAME=10]="RCDATA_END_TAG_NAME",e[e.RAWTEXT_LESS_THAN_SIGN=11]="RAWTEXT_LESS_THAN_SIGN",e[e.RAWTEXT_END_TAG_OPEN=12]="RAWTEXT_END_TAG_OPEN",e[e.RAWTEXT_END_TAG_NAME=13]="RAWTEXT_END_TAG_NAME",e[e.SCRIPT_DATA_LESS_THAN_SIGN=14]="SCRIPT_DATA_LESS_THAN_SIGN",e[e.SCRIPT_DATA_END_TAG_OPEN=15]="SCRIPT_DATA_END_TAG_OPEN",e[e.SCRIPT_DATA_END_TAG_NAME=16]="SCRIPT_DATA_END_TAG_NAME",e[e.SCRIPT_DATA_ESCAPE_START=17]="SCRIPT_DATA_ESCAPE_START",e[e.SCRIPT_DATA_ESCAPE_START_DASH=18]="SCRIPT_DATA_ESCAPE_START_DASH",e[e.SCRIPT_DATA_ESCAPED=19]="SCRIPT_DATA_ESCAPED",e[e.SCRIPT_DATA_ESCAPED_DASH=20]="SCRIPT_DATA_ESCAPED_DASH",e[e.SCRIPT_DATA_ESCAPED_DASH_DASH=21]="SCRIPT_DATA_ESCAPED_DASH_DASH",e[e.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN=22]="SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN",e[e.SCRIPT_DATA_ESCAPED_END_TAG_OPEN=23]="SCRIPT_DATA_ESCAPED_END_TAG_OPEN",e[e.SCRIPT_DATA_ESCAPED_END_TAG_NAME=24]="SCRIPT_DATA_ESCAPED_END_TAG_NAME",e[e.SCRIPT_DATA_DOUBLE_ESCAPE_START=25]="SCRIPT_DATA_DOUBLE_ESCAPE_START",e[e.SCRIPT_DATA_DOUBLE_ESCAPED=26]="SCRIPT_DATA_DOUBLE_ESCAPED",e[e.SCRIPT_DATA_DOUBLE_ESCAPED_DASH=27]="SCRIPT_DATA_DOUBLE_ESCAPED_DASH",e[e.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH=28]="SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH",e[e.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN=29]="SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN",e[e.SCRIPT_DATA_DOUBLE_ESCAPE_END=30]="SCRIPT_DATA_DOUBLE_ESCAPE_END",e[e.BEFORE_ATTRIBUTE_NAME=31]="BEFORE_ATTRIBUTE_NAME",e[e.ATTRIBUTE_NAME=32]="ATTRIBUTE_NAME",e[e.AFTER_ATTRIBUTE_NAME=33]="AFTER_ATTRIBUTE_NAME",e[e.BEFORE_ATTRIBUTE_VALUE=34]="BEFORE_ATTRIBUTE_VALUE",e[e.ATTRIBUTE_VALUE_DOUBLE_QUOTED=35]="ATTRIBUTE_VALUE_DOUBLE_QUOTED",e[e.ATTRIBUTE_VALUE_SINGLE_QUOTED=36]="ATTRIBUTE_VALUE_SINGLE_QUOTED",e[e.ATTRIBUTE_VALUE_UNQUOTED=37]="ATTRIBUTE_VALUE_UNQUOTED",e[e.AFTER_ATTRIBUTE_VALUE_QUOTED=38]="AFTER_ATTRIBUTE_VALUE_QUOTED",e[e.SELF_CLOSING_START_TAG=39]="SELF_CLOSING_START_TAG",e[e.BOGUS_COMMENT=40]="BOGUS_COMMENT",e[e.MARKUP_DECLARATION_OPEN=41]="MARKUP_DECLARATION_OPEN",e[e.COMMENT_START=42]="COMMENT_START",e[e.COMMENT_START_DASH=43]="COMMENT_START_DASH",e[e.COMMENT=44]="COMMENT",e[e.COMMENT_LESS_THAN_SIGN=45]="COMMENT_LESS_THAN_SIGN",e[e.COMMENT_LESS_THAN_SIGN_BANG=46]="COMMENT_LESS_THAN_SIGN_BANG",e[e.COMMENT_LESS_THAN_SIGN_BANG_DASH=47]="COMMENT_LESS_THAN_SIGN_BANG_DASH",e[e.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH=48]="COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH",e[e.COMMENT_END_DASH=49]="COMMENT_END_DASH",e[e.COMMENT_END=50]="COMMENT_END",e[e.COMMENT_END_BANG=51]="COMMENT_END_BANG",e[e.DOCTYPE=52]="DOCTYPE",e[e.BEFORE_DOCTYPE_NAME=53]="BEFORE_DOCTYPE_NAME",e[e.DOCTYPE_NAME=54]="DOCTYPE_NAME",e[e.AFTER_DOCTYPE_NAME=55]="AFTER_DOCTYPE_NAME",e[e.AFTER_DOCTYPE_PUBLIC_KEYWORD=56]="AFTER_DOCTYPE_PUBLIC_KEYWORD",e[e.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER=57]="BEFORE_DOCTYPE_PUBLIC_IDENTIFIER",e[e.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED=58]="DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED",e[e.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED=59]="DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED",e[e.AFTER_DOCTYPE_PUBLIC_IDENTIFIER=60]="AFTER_DOCTYPE_PUBLIC_IDENTIFIER",e[e.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS=61]="BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS",e[e.AFTER_DOCTYPE_SYSTEM_KEYWORD=62]="AFTER_DOCTYPE_SYSTEM_KEYWORD",e[e.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER=63]="BEFORE_DOCTYPE_SYSTEM_IDENTIFIER",e[e.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED=64]="DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED",e[e.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED=65]="DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED",e[e.AFTER_DOCTYPE_SYSTEM_IDENTIFIER=66]="AFTER_DOCTYPE_SYSTEM_IDENTIFIER",e[e.BOGUS_DOCTYPE=67]="BOGUS_DOCTYPE",e[e.CDATA_SECTION=68]="CDATA_SECTION",e[e.CDATA_SECTION_BRACKET=69]="CDATA_SECTION_BRACKET",e[e.CDATA_SECTION_END=70]="CDATA_SECTION_END",e[e.CHARACTER_REFERENCE=71]="CHARACTER_REFERENCE",e[e.AMBIGUOUS_AMPERSAND=72]="AMBIGUOUS_AMPERSAND"})(Ye||(Ye={}));var Nr={DATA:Ye.DATA,RCDATA:Ye.RCDATA,RAWTEXT:Ye.RAWTEXT,SCRIPT_DATA:Ye.SCRIPT_DATA,PLAINTEXT:Ye.PLAINTEXT,CDATA_SECTION:Ye.CDATA_SECTION};var qa=new Set([l.DD,l.DT,l.LI,l.OPTGROUP,l.OPTION,l.P,l.RB,l.RP,l.RT,l.RTC]),Zl=new Set([...qa,l.CAPTION,l.COLGROUP,l.TBODY,l.TD,l.TFOOT,l.TH,l.THEAD,l.TR]);var gn=256,Je=512,Or=768,ec=[l.H1,l.H2,l.H3,l.H4,l.H5,l.H6],Ja=[l.TBODY,l.TFOOT,l.THEAD],tc=[l.TR,l.TEMPLATE,l.HTML],nc=[...Ja,l.TEMPLATE,l.HTML],ic=[l.TABLE,l.TEMPLATE,l.HTML],rc=[l.TD,l.TH],Ir=1,Za=2,eo=4,ii=8,kr=16,Rr=32,Ze=new Uint8Array(Or);for(let[e,t]of[[U.HTML,0],[U.SVG,gn],[U.MATHML,Je]])for(let n of ti[e])Ze[t+n]=e===U.HTML&&(n===l.ADDRESS||n===l.DIV||n===l.P)?Ir:Ir|Za;for(let e of[l.APPLET,l.CAPTION,l.HTML,l.MARQUEE,l.OBJECT,l.TABLE,l.TD,l.TEMPLATE,l.TH,gn+l.DESC,gn+l.FOREIGN_OBJECT,gn+l.TITLE,Je+l.ANNOTATION_XML,Je+l.MI,Je+l.MN,Je+l.MO,Je+l.MS,Je+l.MTEXT])Ze[e]|=eo|ii|kr;Ze[l.OL]|=ii;Ze[l.UL]|=ii;Ze[l.BUTTON]|=kr;Ze[l.TABLE]|=Rr;Ze[l.HTML]|=Rr;var to=new Uint8Array(Or);for(let e of[l.A,l.B,l.BIG,l.CODE,l.EM,l.FONT,l.I,l.NOBR,l.S,l.SMALL,l.STRIKE,l.STRONG,l.TT,l.U])to[e]=1;var ri;(function(e){e[e.Marker=0]="Marker",e[e.Element=1]="Element"})(ri||(ri={}));var no=["+//silmaril//dtd html pro v0r11 19970101//","-//as//dtd html 3.0 aswedit + extensions//","-//advasoft ltd//dtd html 3.0 aswedit + extensions//","-//ietf//dtd html 2.0 level 1//","-//ietf//dtd html 2.0 level 2//","-//ietf//dtd html 2.0 strict level 1//","-//ietf//dtd html 2.0 strict level 2//","-//ietf//dtd html 2.0 strict//","-//ietf//dtd html 2.0//","-//ietf//dtd html 2.1e//","-//ietf//dtd html 3.0//","-//ietf//dtd html 3.2 final//","-//ietf//dtd html 3.2//","-//ietf//dtd html 3//","-//ietf//dtd html level 0//","-//ietf//dtd html level 1//","-//ietf//dtd html level 2//","-//ietf//dtd html level 3//","-//ietf//dtd html strict level 0//","-//ietf//dtd html strict level 1//","-//ietf//dtd html strict level 2//","-//ietf//dtd html strict level 3//","-//ietf//dtd html strict//","-//ietf//dtd html//","-//metrius//dtd metrius presentational//","-//microsoft//dtd internet explorer 2.0 html strict//","-//microsoft//dtd internet explorer 2.0 html//","-//microsoft//dtd internet explorer 2.0 tables//","-//microsoft//dtd internet explorer 3.0 html strict//","-//microsoft//dtd internet explorer 3.0 html//","-//microsoft//dtd internet explorer 3.0 tables//","-//netscape comm. corp.//dtd html//","-//netscape comm. corp.//dtd strict html//","-//o\'reilly and associates//dtd html 2.0//","-//o\'reilly and associates//dtd html extended 1.0//","-//o\'reilly and associates//dtd html extended relaxed 1.0//","-//sq//dtd html 2.0 hotmetal + extensions//","-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//","-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//","-//spyglass//dtd html 2.0 extended//","-//sun microsystems corp.//dtd hotjava html//","-//sun microsystems corp.//dtd hotjava strict html//","-//w3c//dtd html 3 1995-03-24//","-//w3c//dtd html 3.2 draft//","-//w3c//dtd html 3.2 final//","-//w3c//dtd html 3.2//","-//w3c//dtd html 3.2s draft//","-//w3c//dtd html 4.0 frameset//","-//w3c//dtd html 4.0 transitional//","-//w3c//dtd html experimental 19960712//","-//w3c//dtd html experimental 970421//","-//w3c//dtd w3 html//","-//w3o//dtd w3 html 3.0//","-//webtechs//dtd mozilla html 2.0//","-//webtechs//dtd mozilla html//"],uc=[...no,"-//w3c//dtd html 4.01 frameset//","-//w3c//dtd html 4.01 transitional//"];var io=["-//w3c//dtd xhtml 1.0 frameset//","-//w3c//dtd xhtml 1.0 transitional//"],dc=[...io,"-//w3c//dtd html 4.01 frameset//","-//w3c//dtd html 4.01 transitional//"];var hc=new Map(["attributeName","attributeType","baseFrequency","baseProfile","calcMode","clipPathUnits","diffuseConstant","edgeMode","filterUnits","glyphRef","gradientTransform","gradientUnits","kernelMatrix","kernelUnitLength","keyPoints","keySplines","keyTimes","lengthAdjust","limitingConeAngle","markerHeight","markerUnits","markerWidth","maskContentUnits","maskUnits","numOctaves","pathLength","patternContentUnits","patternTransform","patternUnits","pointsAtX","pointsAtY","pointsAtZ","preserveAlpha","preserveAspectRatio","primitiveUnits","refX","refY","repeatCount","repeatDur","requiredExtensions","requiredFeatures","specularConstant","specularExponent","spreadMethod","startOffset","stdDeviation","stitchTiles","surfaceScale","systemLanguage","tableValues","targetX","targetY","textLength","viewBox","viewTarget","xChannelSelector","yChannelSelector","zoomAndPan"].map(e=>[e.toLowerCase(),e])),mc=new Map([["xlink:actuate",{prefix:"xlink",name:"actuate",namespace:U.XLINK}],["xlink:arcrole",{prefix:"xlink",name:"arcrole",namespace:U.XLINK}],["xlink:href",{prefix:"xlink",name:"href",namespace:U.XLINK}],["xlink:role",{prefix:"xlink",name:"role",namespace:U.XLINK}],["xlink:show",{prefix:"xlink",name:"show",namespace:U.XLINK}],["xlink:title",{prefix:"xlink",name:"title",namespace:U.XLINK}],["xlink:type",{prefix:"xlink",name:"type",namespace:U.XLINK}],["xml:lang",{prefix:"xml",name:"lang",namespace:U.XML}],["xml:space",{prefix:"xml",name:"space",namespace:U.XML}],["xmlns",{prefix:"",name:"xmlns",namespace:U.XMLNS}],["xmlns:xlink",{prefix:"xmlns",name:"xlink",namespace:U.XMLNS}]]),so=new Map(["altGlyph","altGlyphDef","altGlyphItem","animateColor","animateMotion","animateTransform","clipPath","feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence","foreignObject","glyphRef","linearGradient","radialGradient","textPath"].map(e=>[e.toLowerCase(),e])),fc=new Set([l.B,l.BIG,l.BLOCKQUOTE,l.BODY,l.BR,l.CENTER,l.CODE,l.DD,l.DIV,l.DL,l.DT,l.EM,l.EMBED,l.H1,l.H2,l.H3,l.H4,l.H5,l.H6,l.HEAD,l.HR,l.I,l.IMG,l.LI,l.LISTING,l.MENU,l.META,l.NOBR,l.OL,l.P,l.PRE,l.RUBY,l.S,l.SMALL,l.SPAN,l.STRONG,l.STRIKE,l.SUB,l.SUP,l.TABLE,l.TT,l.U,l.UL,l.VAR]);var Dc=[l.TR,l.TBODY,l.THEAD,l.TFOOT,l.CAPTION,l.COLGROUP,l.TABLE,l.FRAMESET,l.SELECT,l.TEMPLATE,l.TD,l.TH,l.HEAD,l.BODY,l.HTML];var si;(function(e){e[e.INITIAL=0]="INITIAL",e[e.BEFORE_HTML=1]="BEFORE_HTML",e[e.BEFORE_HEAD=2]="BEFORE_HEAD",e[e.IN_HEAD=3]="IN_HEAD",e[e.IN_HEAD_NO_SCRIPT=4]="IN_HEAD_NO_SCRIPT",e[e.AFTER_HEAD=5]="AFTER_HEAD",e[e.IN_BODY=6]="IN_BODY",e[e.TEXT=7]="TEXT",e[e.IN_TABLE=8]="IN_TABLE",e[e.IN_TABLE_TEXT=9]="IN_TABLE_TEXT",e[e.IN_CAPTION=10]="IN_CAPTION",e[e.IN_COLUMN_GROUP=11]="IN_COLUMN_GROUP",e[e.IN_TABLE_BODY=12]="IN_TABLE_BODY",e[e.IN_ROW=13]="IN_ROW",e[e.IN_CELL=14]="IN_CELL",e[e.IN_SELECT=15]="IN_SELECT",e[e.IN_SELECT_IN_TABLE=16]="IN_SELECT_IN_TABLE",e[e.IN_TEMPLATE=17]="IN_TEMPLATE",e[e.AFTER_BODY=18]="AFTER_BODY",e[e.IN_FRAMESET=19]="IN_FRAMESET",e[e.AFTER_FRAMESET=20]="AFTER_FRAMESET",e[e.AFTER_AFTER_BODY=21]="AFTER_AFTER_BODY",e[e.AFTER_AFTER_FRAMESET=22]="AFTER_AFTER_FRAMESET"})(si||(si={}));var Pc=new Set([l.TABLE,l.TBODY,l.TFOOT,l.THEAD,l.TR]);var Mc=new Set([l.CAPTION,l.COL,l.COLGROUP,l.TBODY,l.TD,l.TFOOT,l.TH,l.THEAD,l.TR]);var Uc=new Set([p.AREA,p.BASE,p.BASEFONT,p.BGSOUND,p.BR,p.COL,p.EMBED,p.FRAME,p.HR,p.IMG,p.INPUT,p.KEYGEN,p.LINK,p.META,p.PARAM,p.SOURCE,p.TRACK,p.WBR]);var ho={thin:100,extralight:200,light:300,normal:400,medium:500,semibold:600,bold:700,extrabold:800,black:900},fu=Object.fromEntries(Object.entries(ho).map(([e,t])=>[t,e]));var Mr=new WeakMap;function wr(e){return Mr.get(e)}function ai(e,t){let n=[...e];return Mr.set(n,t),n}function mo(e){let t=/^\\[(-?\\d+(?:\\.\\d+)?)px\\]$/.exec(e);return t?Number(t[1]):e==="0"||e==="[0]"?0:e==="px"?1:(t=/^(\\d+(?:\\.\\d+)?)$/.exec(e),t?Number(t[1])*4:null)}function wt(e,t){for(let n=0;n<e.length;n++){let i=e[n];if(i.includes(":")||i.startsWith("!")||i.endsWith("!"))continue;let a=i.startsWith("-"),s=a?i.slice(1):i;if(!s.startsWith(t+"-"))continue;let o=mo(s.slice(t.length+1));return{index:n,token:i,px:o===null?null:a?-o:o}}return null}var Pr=(e,t)=>`${e}-[${Math.round(t)}px]`;function Br(e,t){if(t.position!=="absolute"&&t.position!=="fixed")return{x:"none",y:"none"};let n=(s,o)=>wt(e,s)!==null||wt(e,o)!==null||wt(e,"inset")!==null,i=n("left","inset-x")?"left":n("right","inset-x")?"right":"none",a=n("top","inset-y")?"top":n("bottom","inset-y")?"bottom":"none";return{x:i,y:a}}function Fr(e,t,n){let i=[...e],a=[];for(let s of t){if(Math.round(s.delta)===0)continue;let o=wt(i,s.prefix);if(o&&o.px===null)return ai(e,`cannot rewrite ${o.token}`);let c=o?o.px:n?.[s.prefix]??0,d=Math.round(c+s.delta);if(s.prefix.startsWith("translate-")&&d===0){o&&a.push(o.index);continue}o?i[o.index]=Pr(s.prefix,d):i.push(Pr(s.prefix,d))}return i.filter((s,o)=>!a.includes(o))}function Hr(e,t,n,i,a){for(let o of e){if(o.includes(":"))continue;let c=/^-?(translate-[xy])-/.exec(o);if(c&&wt([o],c[1])?.px===null)return ai(e,`cannot rewrite ${o}`);if(/^-?inset(-[xy])?-/.test(o))return ai(e,`inset utilities are not supported: ${o}`)}let s=[];return a?s.push({prefix:"translate-x",delta:n},{prefix:"translate-y",delta:i}):(t.x==="left"?s.push({prefix:"left",delta:n}):t.x==="right"?s.push({prefix:"right",delta:-n}):s.push({prefix:"translate-x",delta:n}),t.y==="top"?s.push({prefix:"top",delta:i}):t.y==="bottom"?s.push({prefix:"bottom",delta:-i}):s.push({prefix:"translate-y",delta:i})),Fr(e,s)}function Ur(e,t,n,i,a,s){let o=[];return n.includes("e")?(o.push({prefix:"w",delta:i}),t.x==="right"&&o.push({prefix:"right",delta:-i})):n.includes("w")&&(o.push({prefix:"w",delta:-i}),t.x==="left"&&o.push({prefix:"left",delta:i})),n.includes("s")?(o.push({prefix:"h",delta:a}),t.y==="bottom"&&o.push({prefix:"bottom",delta:-a})):n.includes("n")&&(o.push({prefix:"h",delta:-a}),t.y==="top"&&o.push({prefix:"top",delta:a})),Fr(e,o,{w:s.w,h:s.h})}function li(e){return e.button===0}function $r(e,t,n,i){let a=Br(e,{position:t});return i.kind==="move"?Hr(e,a,i.dx,i.dy,t!=="absolute"&&t!=="fixed"):Ur(e,a,i.handle,i.dx,i.dy,{w:n.width,h:n.height})}var Wr=e=>wr(e),zr=(e,t)=>t==="x"?[e.x,e.x+e.width/2,e.x+e.width]:[e.y,e.y+e.height/2,e.y+e.height];function oi(e,t,n){return{...e,x:e.x+t,y:e.y+n}}function Yr(e,t,n,i){let s=[...(n==="x"?[0,960,1920]:[0,540,1080]).map(c=>({at:c,span:n==="x"?[0,1080]:[0,1920]})),...t.flatMap(c=>zr(c,n).map(d=>({at:d,span:n==="x"?[Math.min(e.y,c.y),Math.max(e.y+e.height,c.y+c.height)]:[Math.min(e.x,c.x),Math.max(e.x+e.width,c.x+c.width)]})))],o=null;for(let c of zr(e,n))for(let d of s){let m=d.at-c;Math.abs(m)<=i&&(!o||Math.abs(m)<Math.abs(o.delta))&&(o={delta:m,at:d.at,span:d.span})}return o?{adjust:o.delta,guide:{axis:n,at:o.at,from:o.span[0],to:o.span[1]}}:{adjust:0}}function fo(e,t,n){let i=[...t].sort((a,s)=>a.x-s.x);for(let a=0;a<i.length-1;a++){let s=i[a],o=i[a+1],c=(s.x+s.width+o.x-e.width)/2;if(c>=s.x+s.width&&c+e.width<=o.x&&Math.abs(e.x-c)<=n)return c-e.x}return null}function Kr(e,t,n,i,a){let s=6/Math.max(a,.01),o=oi(e,t,n),c=fo(o,i,s),d=!1;c!==null&&(t+=c,o=oi(e,t,n),d=!0);let m=Yr(o,i,"x",s);t+=m.adjust,o=oi(e,t,n);let u=Yr(o,i,"y",s);n+=u.adjust;let y=[m.guide,u.guide].filter(v=>!!v);return{dx:t,dy:n,guides:y,equalSpacing:d,distances:[{axis:"x",value:Math.round(Math.abs(t)),x:e.x+t/2,y:e.y-18},{axis:"y",value:Math.round(Math.abs(n)),x:e.x+e.width+18,y:e.y+n/2}].filter(v=>v.value>0)}}var Eo=/^(?:static|relative|absolute|fixed|sticky|(?:-?translate-[xy])-.+|(?:left|right|top|bottom|inset(?:-[xy])?)-.+|w-.+|h-.+)$/;function Gr(e,t,n){return[...e.filter(a=>a.includes(":")||!Eo.test(a)),"absolute",`left-[${Math.round(t.x-n.x)}px]`,`top-[${Math.round(t.y-n.y)}px]`,`w-[${Math.round(t.width)}px]`,`h-[${Math.round(t.height)}px]`]}var To={fontFamily:"font-family",fontSize:"font-size",fontWeight:"font-weight",textColour:"text-color",fillColour:"bg-color",lineHeight:"leading",opacity:"opacity",left:"left",right:"right",top:"top",bottom:"bottom"},go=e=>String(Math.round(e*100)/100);function Qr(e,t,n){if(typeof n=="number"&&!Number.isFinite(n))throw new TypeError(`${t} must be finite`);let i=n;return t==="fontSize"?i=Math.max(12,Math.min(240,Number(n))):t==="lineHeight"?i=Math.max(.6,Math.min(2.4,Number(n))):t==="opacity"&&(i=Math.max(0,Math.min(1,Number(n))),i===1&&(i=100)),{kind:"setUtility",id:e,group:To[t],value:typeof i=="number"?go(i):i}}function Vr(e){return[...new Set(e.filter(t=>Number.isFinite(t)&&t>0).map(t=>Math.max(12,Math.min(240,Math.round(t*10)/10))))].sort((t,n)=>t-n)}function jr(e,t){return t.length?t.reduce((n,i)=>Math.abs(i-e)<Math.abs(n-e)?i:n,t[0]):Math.round(e*10)/10}var ci=e=>!e.includes(":")&&!e.startsWith("!")&&!e.endsWith("!"),Xr=/^\\[(?:-?\\d*\\.?\\d+(?:px|rem|em|%)?|(?:calc|min|max|clamp)\\(.+)\\)]$/;function $e(e,t,n){let i=e.findIndex(s=>ci(s)&&t(s));if(i<0)return[...e,n];let a=e.slice();return a[i]=n,a.filter((s,o)=>o===i||!ci(s)||!t(s))}var _n=e=>`[${Math.max(0,Number(e))}px]`;function qr(e,t,n){if(typeof n=="number"&&!Number.isFinite(n))throw new TypeError(`${t} must be finite`);switch(t){case"padding":return $e(e,i=>/^p-(?![trblesxy]-)/.test(i),`p-${_n(n)}`);case"margin":return $e(e,i=>/^m-(?![trblesxy]-)/.test(i),`m-${_n(n)}`);case"radius":return $e(e,i=>/^rounded(?:-|$)/.test(i),`rounded-${_n(n)}`);case"shadow":return $e(e,i=>/^shadow(?:-|$)/.test(i),n==="none"?"shadow-none":`shadow-${n}`);case"borderWidth":return $e(e,i=>i==="border"||/^border-(?:0|2|4|8)$/.test(i)||i.startsWith("border-")&&Xr.test(i.slice(7)),Number(n)===1?"border":`border-${_n(n)}`);case"borderColour":return $e(e,i=>/^border-(?![trblesxy](?:-|$))/.test(i)&&!/^border-(?:0|2|4|8)$/.test(i)&&!Xr.test(i.slice(7)),`border-${n}`)}}function Jr(e,t){let n=e;if(t.fit&&(n=$e(n,i=>i==="object-cover"||i==="object-contain",`object-${t.fit}`)),t.focalX!==void 0||t.focalY!==void 0){let i=n.find(d=>ci(d)&&/^object-\\[\\d+(?:\\.\\d+)?%_\\d+(?:\\.\\d+)?%\\]$/.test(d)),a=i&&/^object-\\[(\\d+(?:\\.\\d+)?)%_(\\d+(?:\\.\\d+)?)%\\]$/.exec(i),s=d=>Math.max(0,Math.min(100,Math.round(d))),o=s(t.focalX??Number(a?.[1]??50)),c=s(t.focalY??Number(a?.[2]??50));n=$e(n,d=>/^object-\\[\\d+(?:\\.\\d+)?%_\\d+(?:\\.\\d+)?%\\]$/.test(d),`object-[${o}%_${c}%]`)}return n}function bn(e){if(e instanceof ct&&e.code==="conflict"){Ce.value=!0,ce.value||(ce.value={diskFingerprint:String(e.body.diskFingerprint??"")});return}se.value={kind:"error",message:e instanceof Error?e.message:String(e)}}async function Ft(e){let t=await Dt(e);return t==="skipped"&&(ne.value={dirty:e.dirty,changedLines:e.changedLines,canUndo:e.canUndo,canRedo:e.canRedo}),{...e,how:t}}var Zr=Promise.resolve();function Ht(e){let t=Zr.then(e,e);return Zr=t.catch(()=>{}),t}function es(){return Ht(()=>ze(()=>{}))}async function K(e,t={}){return Ht(async()=>{let n=await ze(()=>P.ops(e,oe.value,t));return Ft(n)})}async function xn(e,t={}){return Ht(async()=>{await Cr();let n=e();if(!n.length)return null;let i=await ze(()=>P.ops(n,oe.value,t));return Ft(i)})}async function ts(e){await Ht(async()=>{await Ft((await P.acceptAiRequest(e)).result)})}async function An(){if(ne.value.canUndo)try{await Ft(await P.undo())}catch(e){bn(e)}}async function vn(){if(ne.value.canRedo)try{await Ft(await P.redo())}catch(e){bn(e)}}async function mt(){if(!Ue.value){Ue.value=!0;try{await Ht(async()=>{if(ce.value){Ce.value=!0;return}if(!ne.value.dirty)return;let e=await P.save();ne.value={...ne.value,dirty:e.dirty,changedLines:e.changedLines},Re.value="savedToast"})}catch(e){bn(e)}finally{Ue.value=!1}}}async function yn(e){try{let t=await P.resolve(e);ce.value=null,Ce.value=!1,await ye(),t.failed.length?se.value={kind:"resolved",failed:t.failed.map(n=>n.label||n.code)}:(se.value=null,Re.value=e==="reload"?"resolvedReload":"resolvedOk")}catch(t){t instanceof ct&&t.code==="not-replayable"?se.value={kind:"not-replayable"}:bn(t)}}function pe(e){let t=Le.value;if(t===0)return;let n=Math.max(0,Math.min(t-1,e));n!==D.value&&(R.value=null,w.value=[],ie.value=null),D.value=n,pn(n)}function Ee(e,t=!1){if(t&&e){let n=w.value.includes(e);w.value=n?w.value.filter(i=>i!==e):[...w.value,e],R.value=n?w.value[w.value.length-1]??null:e}else w.value=e?[e]:[],R.value=e;e&&q.value==="agent"&&(q.value="props")}var Ut=e=>(e.getAttribute("class")??"").split(/\\s+/).filter(Boolean);async function Cn(e,t,n){let i=pt();if(!i)return;let a=e.flatMap(s=>{let o=L(s);if(!o)return[];let c=Ut(o),d=De(o),m=$r(c,i.getComputedStyle(o).position,{x:d.left,y:d.top,width:d.width,height:d.height},t),u=Wr(m);return u?(se.value={kind:"error",message:u},[]):m.join(" ")===c.join(" ")?[]:[{kind:"setClasses",id:s,classes:m}]});a.length&&await K(a,{label:t.kind==="move"?"Move selection":"Resize selection",...n?{coalesceKey:n}:{}})}async function ns(){let e=[...w.value];e.length&&await K(e.map(t=>({kind:"duplicate",id:t})),{label:"Duplicate selection"})}async function is(){let e=w.value.filter(t=>{let n=L(t);return n&&!w.value.some(i=>i!==t&&L(i)?.contains(n))});e.length&&(await K(e.map(t=>({kind:"remove",id:t})),{label:"Delete selection"}),Ee(null))}async function rs(e,t){let n=L(R.value),i=n?.parentElement,a=i?.getAttribute("data-nm-key");if(!n||!i||!a)return;let s=Array.from(i.children).filter(d=>d.hasAttribute("data-nm-key")),o=s.indexOf(n),c=t?e>0?s.length-1:0:Math.max(0,Math.min(s.length-1,o+e));c!==o&&await K([{kind:"move",id:R.value,parent:a,index:c}],{label:"Change z-order"})}async function ss(){let e=R.value,t=L(e),n=t&&"offsetParent"in t?t.offsetParent:null;if(!e||!t||!n)return;let i=De(t),a=De(n),s=Gr(Ut(t),{x:i.left,y:i.top,width:i.width,height:i.height},{x:a.left,y:a.top,width:a.width,height:a.height});await K([{kind:"setClasses",id:e,classes:s}],{label:"Free position"})}async function as(e,t,n){await xn(()=>{let i=L(e);return i?[{kind:"setClasses",id:e,classes:qr(Ut(i),t,n)}]:[]},{label:`Set ${t}`,coalesceKey:`property:${e}:${t}`})}async function zt(e,t){await xn(()=>{let n=L(e);return n?.tagName.toLowerCase()==="img"?[{kind:"setClasses",id:e,classes:Jr(Ut(n),t)}]:[]},{label:"Set image crop",coalesceKey:`image:${e}`})}async function os(e,t){let n=L(e);if(!n)return;let i=Ut(n).filter(a=>a!=="hidden");t&&i.push("hidden"),await K([{kind:"setClasses",id:e,classes:i}],{label:t?"Hide layer":"Show layer"})}async function ui(e,t){let n=L(e),i=n?.parentElement,a=i?.getAttribute("data-nm-key");if(!n||!i||!a)return;let s=Array.from(i.children).filter(d=>d.hasAttribute("data-nm-key")),o=s.indexOf(n),c=Math.max(0,Math.min(s.length-1,o+t));c!==o&&await K([{kind:"move",id:e,parent:a,index:c}],{label:"Reorder layer"})}async function ls(e){let n=L(le.value?.slides[D.value]?.key??null)?.parentElement,i=n?.getAttribute("data-nm-key");if(!n||!i)return;let a=await P.layoutPreset(e),s=Array.from(n.children).filter(o=>o.matches("section.slide")&&o.hasAttribute("data-nm-key")).length;await K([{kind:"insertHtml",parent:i,index:s,html:a.html}],{label:`Add slide: ${a.name}`}),await ye(),pe(Math.min(s,Le.value-1))}async function cs(){let e=le.value?.slides[D.value];if(!e)return;let t=D.value+1;await K([{kind:"duplicate",id:e.key}],{label:"Duplicate slide"}),await ye(),pe(Math.min(t,Le.value-1))}async function us(){let e=le.value?.slides[D.value];if(!e||Le.value<=1)return;let t=Math.max(0,D.value-(D.value===Le.value-1?1:0));await K([{kind:"remove",id:e.key}],{label:"Delete slide"}),await ye(),pe(t)}async function di(e){let t=L(le.value?.slides[D.value]?.key??null),n=t?.parentElement,i=n?.getAttribute("data-nm-key");if(!t||!n||!i)return;let a=Array.from(n.children).filter(c=>c.matches("section.slide")&&c.hasAttribute("data-nm-key")),s=a.indexOf(t),o=Math.max(0,Math.min(a.length-1,s+e));o!==s&&(await K([{kind:"move",id:t.getAttribute("data-nm-key"),parent:i,index:o}],{label:"Reorder slide"}),await ye(),pe(o))}var _o=async e=>{let t=new Uint8Array(await e.arrayBuffer()),n="";for(let i=0;i<t.length;i+=32768)n+=String.fromCharCode(...t.subarray(i,i+32768));return btoa(n)};async function ds(e,t){let n=L(e);if(!n||n.tagName.toLowerCase()!=="img")return;let i=await P.uploadImage({name:t.name,type:t.type,data:await _o(t)});await K([{kind:"setAttr",id:e,name:"src",value:i.path}],{label:"Replace image"})}var Bt=[.1,.25,.33,.5,.67,.75,1,1.25,1.5,2,3];function bo(e,t){return t>0?Bt.find(n=>n>e+.001)??Bt[Bt.length-1]:[...Bt].reverse().find(n=>n<e-.001)??Bt[0]}function pi(e){let t=bo(j.value,e),n=dt.value,i=j.value<n&&t>n||j.value>n&&t<n;Fe.value=i?"fit":t}var ps=()=>{Fe.value="fit"};function Sn(e){te.value=e;let t=new URL(location.href);e==="en"?t.searchParams.set("lang","en"):t.searchParams.delete("lang"),history.replaceState(null,"",t)}function Nn(){let e=de();if(!e)return;let t=!ae.value;ae.value=t,e.freeze(!t),t||pn(D.value)}var xo=Symbol.for("pv"),Ao=0;function r(e,t,n,i,a,s){t||(t={});var o,c,d=t;if("ref"in d&&typeof e!="function")for(c in d={},t)c=="ref"?o=t[c]:d[c]=t[c];var m={type:e,props:d,key:n,ref:o,__k:null,__:null,__b:0,__e:null,__c:null,constructor:xo,__v:--Ao,__i:-1,__u:0};return(a||s)&&(m.__source=a,m.__self=s),O.vnode&&O.vnode(m),m}var vo={edit:r("path",{d:"m4 4 7 17 2.5-7.5L21 11z"}),insert:r("path",{d:"M5 6V4h14v2M12 4v16M9 20h6"}),motion:r("path",{d:"M4 12h6M14 12h6M8 8l-4 4 4 4M16 8l4 4-4 4"}),identity:r($,{children:[r("circle",{cx:"12",cy:"12",r:"8"}),r("path",{d:"M12 4a8 8 0 0 0 0 16z"})]}),undo:r($,{children:[r("path",{d:"M9 14 4 9l5-5"}),r("path",{d:"M4 9h10.5a5.5 5.5 0 0 1 0 11H11"})]}),redo:r($,{children:[r("path",{d:"m15 14 5-5-5-5"}),r("path",{d:"M20 9H9.5a5.5 5.5 0 0 0 0 11H13"})]}),play:r("path",{d:"M7 4l13 8-13 8z"}),pause:r("path",{d:"M8 5v14M16 5v14"}),plus:r("path",{d:"M12 5v14M5 12h14"}),warn:r("path",{d:"M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z"}),chevronUp:r("path",{d:"m6 15 6-6 6 6"}),chevronDown:r("path",{d:"m6 9 6 6 6-6"}),export:r("path",{d:"M12 15V4M8 8l4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"}),close:r("path",{d:"M6 6l12 12M18 6 6 18"}),link:r("path",{d:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"}),eye:r($,{children:[r("path",{d:"M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"}),r("circle",{cx:"12",cy:"12",r:"2.5"})]}),eyeOff:r($,{children:r("path",{d:"M3 3l18 18M10.5 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.2 7.3C3.8 9.1 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 2-.2"})})};function z({name:e,class:t}){return r("svg",{class:`i${t?` ${t}`:""}`,viewBox:"0 0 24 24","aria-hidden":"true",focusable:"false",children:vo[e]})}function hs(){let e=B.value,t=ce.value,n=se.value,i=k(null);return H(()=>{Ce.value&&i.current?.querySelector("button")?.focus()},[Ce.value]),r("div",{class:"banners",children:[t&&r("div",{class:"banner raised conflict",role:"alert",ref:i,"data-testid":"conflict-banner","data-refused":Ce.value?"":void 0,children:[r(z,{name:"warn"}),r("div",{class:"msg",children:[r("b",{children:Ce.value?e.saveRefused:e.conflictTitle}),r("span",{children:t.deleted?e.conflictDeleted:e.conflictBody})]}),r("div",{class:"acts",children:[r("button",{type:"button",class:"raised-s",onClick:()=>yn("reload"),"data-testid":"resolve-reload",children:e.acceptAgent}),r("button",{type:"button",class:"raised-s",onClick:()=>yn("reapply"),disabled:!!t.deleted,"data-testid":"resolve-reapply",children:e.reapply})]})]}),!t&&n&&r("div",{class:`banner raised ${n.kind}`,role:n.kind==="error"?"alert":"status","data-testid":"banner","data-kind":n.kind,children:[r(z,{name:"warn"}),r("div",{class:"msg",children:[n.kind==="resolved"&&r("b",{children:e.resolvedFailed(n.failed)}),n.kind==="not-replayable"&&r("b",{children:e.notReplayable}),n.kind==="error"&&r("b",{children:e.requestFailed(n.message)})]}),r("div",{class:"acts",children:[n.kind==="not-replayable"&&r("button",{type:"button",class:"raised-s",onClick:()=>yn("reload"),children:e.acceptAgent}),r("button",{type:"button",class:"round raised-s",onClick:()=>{se.value=null},"aria-label":e.dismiss,title:e.dismiss,children:r(z,{name:"close"})})]})]}),!je.value&&r("div",{class:"banner raised quiet",role:"status",children:e.reconnecting})]})}function ms(){let e=B.value,t=Re.value;return H(()=>{if(!t)return;let n=setTimeout(()=>{Re.value=null},3500);return()=>clearTimeout(n)},[t]),r("div",{class:"toast-slot",role:"status","aria-live":"polite",children:t&&r("div",{class:"toast raised-s","data-testid":"toast",children:e[t]})})}function yo(e,t,n){return e.map((i,a)=>({s:i,i:a})).filter(({s:i,i:a})=>i==="idle"&&n.has(a)).map(({i})=>i).sort((i,a)=>Math.abs(i-t)-Math.abs(a-t)||i-a)}function fs(e,t,n,i){let a=e.filter(s=>s==="loading").length;return yo(e,t,n).slice(0,Math.max(0,i-a))}var Co=1,So=172,No=So/1920,Se=N([]),ft=new Map,mi=new Set,hi=null,Et={firstRequest:0,lastReady:0,loads:0},Es=e=>{try{return e?.contentWindow?.__nm??null}catch{return null}};function fi(e,t){let n=Se.value.slice();n[e]=t,Se.value=n}function Yt(){if(be.value)return;let e=mi.has(D.value)?new Set([D.value]):new Set;for(let t of fs(Se.value,D.value,e,Co)){let n=ft.get(t);n&&(Et.firstRequest||(Et.firstRequest=performance.now()),fi(t,"loading"),n.src=dr())}}function Io(e){let t=ft.get(e),n=Es(t);!t||!n||!t.src||(n.goTo(e),fi(e,"ready"),Et.loads++,Et.lastReady=performance.now(),Yt())}function Ts(){Se.value=Se.value.map(()=>"idle"),Yt()}xr((e,t)=>{if(e==="reloaded"){hi&&clearTimeout(hi),hi=setTimeout(Ts,600);return}let n=t.previewPatch;Se.value.forEach((i,a)=>{if(i!=="ready")return;(Es(ft.get(a))?.applyPatch(n)??["gone"]).length&&fi(a,"idle")}),Yt()});function Oo({i:e,observer:t}){let n=B.value,i=k(null),a=e===D.value,s=qe(e)??n.untitled,o=Se.value[e]??"idle";return H(()=>{let c=i.current;if(!(!c||!t))return t.observe(c),()=>t.unobserve(c)},[t]),H(()=>()=>{ft.delete(e)},[e]),r("button",{ref:i,type:"button",class:`tile ${a?"cur":"raised-s"}`,"data-index":e,"aria-current":a?"true":void 0,tabIndex:a?0:-1,onClick:()=>pe(e),title:s,"data-testid":"fihris-tile",children:[!be.value&&r("span",{class:`thumb ${o}`,"aria-hidden":"true",children:a&&r("iframe",{ref:c=>{c?ft.set(e,c):ft.delete(e)},tabIndex:-1,title:"","aria-hidden":"true",onLoad:()=>Io(e),style:{transform:`scale(${No})`}})}),r("span",{class:"cap",children:[r("span",{class:"n",children:n.fihrisNumber(e+1)}),r("span",{class:"tt",children:s})]})]})}function gs(){let e=B.value,t=Le.value,n=k(null),i=k(null),[a,s]=W(!1),[o,c]=W([]);H(()=>{if(!a||o.length)return;let m=!0;return P.layoutPresets().then(u=>{m&&c(u.presets)}).catch(()=>{m&&c([])}),()=>{m=!1}},[a]),Se.value.length!==t&&(Se.value=Array.from({length:t},(m,u)=>Se.value[u]??"idle")),!i.current&&typeof IntersectionObserver<"u"&&(i.current=new IntersectionObserver(m=>{for(let u of m){let y=Number(u.target.dataset.index);u.isIntersecting?mi.add(y):mi.delete(y)}Yt()},{rootMargin:"0px 200px"})),H(()=>{n.current?.querySelector(".tile.cur")?.scrollIntoView({block:"nearest",inline:"nearest"}),Yt()},[D.value,t]),H(()=>{Ts()},[be.value]);let d=m=>{let u=Array.from(n.current?.querySelectorAll(".tile")??[]),y=u.indexOf(document.activeElement);if(y<0)return;let v=getComputedStyle(n.current).direction==="rtl",h={ArrowLeft:v?1:-1,ArrowRight:v?-1:1,Home:-1/0,End:1/0}[m.code];if(h===void 0)return;m.preventDefault();let T=Math.max(0,Math.min(u.length-1,Number.isFinite(h)?y+h:h>0?u.length-1:0));u.forEach((f,E)=>{f.tabIndex=E===T?0:-1}),u[T].focus()};return r("nav",{class:`fihris raised${be.value?" compact":""}`,"aria-label":e.fihrisLabel,children:[r("div",{class:"tiles",ref:n,onKeyDown:d,children:Array.from({length:t},(m,u)=>r(Oo,{i:u,observer:i.current},u))}),r("button",{type:"button",class:"add raised-s",onClick:()=>s(!a),"aria-expanded":a,title:e.addSlide,"aria-label":e.addSlide,"data-testid":"add-slide",children:r(z,{name:"plus"})}),r("div",{class:"slide-actions",role:"group","aria-label":e.fihrisLabel,children:[r("button",{type:"button",title:e.moveSlideBefore,"aria-label":e.moveSlideBefore,onClick:()=>{di(-1)},children:r(z,{name:"chevronUp"})}),r("button",{type:"button",title:e.moveSlideAfter,"aria-label":e.moveSlideAfter,onClick:()=>{di(1)},children:r(z,{name:"chevronDown"})}),r("button",{type:"button",title:e.duplicateSlide,"aria-label":e.duplicateSlide,onClick:()=>{cs()},children:r("span",{"aria-hidden":"true",children:"++"})}),r("button",{type:"button",title:e.deleteSlide,"aria-label":e.deleteSlide,onClick:()=>{us()},children:r(z,{name:"close"})})]}),a&&r("div",{class:"layout-picker raised",role:"dialog","aria-label":e.chooseLayout,"data-testid":"layout-picker",children:[r("div",{class:"layout-picker-head",children:[r("strong",{children:e.chooseLayout}),r("button",{type:"button",onClick:()=>s(!1),"aria-label":e.dismiss,children:r(z,{name:"close"})})]}),r("div",{class:"layout-list",children:o.map(m=>r("button",{type:"button","data-preset":m.id,onClick:()=>{s(!1),ls(m.id)},children:[r("small",{children:m.slot}),r("span",{children:m.name})]},m.id))})]}),r("button",{type:"button",class:"fold raised-s",onClick:()=>{be.value=!be.value},"aria-expanded":!be.value,title:be.value?e.fihrisExpand:e.fihrisCollapse,"aria-label":be.value?e.fihrisExpand:e.fihrisCollapse,"data-testid":"fihris-fold",children:r(z,{name:be.value?"chevronUp":"chevronDown"})})]})}var ko=e=>new Promise(t=>setTimeout(t,e)),Ro=["html","pdf","png","pptx","pptx-editable"];function _s(){let e=B.value,t=k(null),[n,i]=W("html"),[a,s]=W(!1),[o,c]=W(null),[d,m]=W(null),u=k(0);H(()=>{let E=t.current;E&&(ve.value&&!E.open&&E.showModal(),!ve.value&&E.open&&E.close())},[ve.value]);let y={html:[e.exportHtml,e.exportHtmlHint],pdf:[e.exportPdf,e.exportPdfHint],png:[e.exportPng,e.exportPngHint],pptx:[e.exportPptx,e.exportPptxHint],"pptx-editable":[e.exportPptxEditable,e.exportPptxEditableHint]},v=async()=>{let E=++u.current;m(null);try{let b=await P.createExport(n,a);for(c(b);b.status==="running";){if(await ko(400),E!==u.current)return;b=await P.exportJob(b.id),c(b)}}catch(b){E===u.current&&(c(null),m(b instanceof Error?b.message:String(b)))}},h=o?.status==="running",T=d??(o?.status==="failed"?o.error??"":null),f=o?.status==="ready"?(o.fonts??[]).filter(E=>!E.licensed):[];return r("dialog",{ref:t,class:"export-dialog raised","aria-labelledby":"export-title","data-testid":"export-dialog",onKeyDown:E=>{if(E.key!=="Tab")return;let b=[...t.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")??[]];if(!b.length)return;let _=b[0],x=b[b.length-1],C=document.activeElement;E.shiftKey&&(C===_||!t.current?.contains(C))?(E.preventDefault(),x.focus()):!E.shiftKey&&(C===x||!t.current?.contains(C))&&(E.preventDefault(),_.focus())},onClose:()=>{u.current++,ve.value=!1},children:ve.value&&r($,{children:[r("div",{class:"export-head",children:[r("h2",{id:"export-title",children:e.exportTitle}),r("button",{type:"button",class:"round raised-s","aria-label":e.exportClose,title:e.exportClose,onClick:()=>t.current?.close(),children:r(z,{name:"close"})})]}),r("p",{class:"export-intro",children:e.exportIntro}),r("fieldset",{class:"export-formats",disabled:h,children:[r("legend",{children:e.exportFormatLabel}),Ro.map(E=>r("label",{class:`export-format${n===E?" on":""}`,children:[r("input",{type:"radio",name:"export-format",value:E,checked:n===E,onChange:()=>{i(E),c(null),m(null)},"data-testid":`export-format-${E}`}),r("span",{class:"name",children:[y[E][0],E==="pptx-editable"&&r("em",{class:"chip","data-testid":"export-experimental",children:e.exportExperimental})]}),r("span",{class:"hint",children:y[E][1]})]},E))]}),n==="html"&&r("label",{class:"export-check",children:[r("input",{type:"checkbox",checked:a,disabled:h,onChange:E=>s(E.currentTarget.checked),"data-testid":"export-allow-remote"}),r("span",{children:e.exportAllowRemote})]}),r("div",{class:"export-status",role:"status","aria-live":"polite","data-testid":"export-status","data-state":T!==null?"failed":o?.status??"idle",children:[h&&r("span",{children:e.exportRunning}),T!==null&&r("span",{class:"bad",children:e.exportFailed(T)}),o?.status==="ready"&&o.filename&&r("span",{children:e.exportReady(o.filename,o.slides??0)})]}),o?.status==="ready"&&(o.experimental||f.length>0||(o.remote??[]).length>0)&&r("section",{class:"export-warn","aria-labelledby":"export-warn-title","data-testid":"export-warnings",children:[r("h3",{id:"export-warn-title",children:e.exportWarnTitle}),r("ul",{children:[o.experimental&&r("li",{children:e.exportExperimentalWarn}),f.length>0&&r("li",{children:e.exportFontNote}),f.map(E=>r("li",{children:[e.exportFontWarn," ",r("bdi",{dir:"ltr",class:"path",children:E.path})]},E.path)),(o.remote??[]).map(E=>r("li",{children:e.exportRemoteWarn(E)},E))]})]}),r("div",{class:"export-actions",children:[o?.status==="ready"&&r("a",{class:"export-download raised-s",href:hr(o.id),download:o.filename,"data-testid":"export-download",children:e.exportDownload}),r("button",{type:"button",class:"export-run raised-s",onClick:v,disabled:h,"data-testid":"export-run",children:e.exportRun})]})]})})}var Lo=[{id:"edit",icon:"edit"},{id:"insert",icon:"insert"},{id:"motion",icon:"motion"},{id:"identity",icon:"identity"}];function Do(){let e=B.value,{dirty:t,changedLines:n}=ne.value,i=k(null),a=k(n);return H(()=>{let s=i.current;s&&a.current!==n&&t&&(s.classList.remove("tick"),s.offsetWidth,s.classList.add("tick")),a.current=n},[n,t]),r("span",{class:`pill raised-s${t?" is-dirty":""}`,role:"status","aria-label":t?e.linesLabel(n):e.saved,"data-testid":"dirty-pill",children:[r("i",{class:"dot","aria-hidden":"true"}),t?r($,{children:[r("span",{children:e.unsaved}),r("span",{class:"read pill-n",ref:i,"data-testid":"dirty-count",children:Te(n,te.value)}),r("span",{children:e.linesWord(n)})]}):r("span",{children:e.saved})]})}function bs(){let e=B.value,t=qe(0)??"",n=ne.value,i={edit:e.modeEdit,insert:e.modeInsert,motion:e.modeMotion,identity:e.modeIdentity};return r("header",{class:"masthead",children:[r("div",{class:"mark",children:[r("span",{class:"logo raised-s","aria-hidden":"true",children:r("i",{})}),r("div",{class:"mark-text",children:[r("b",{class:"wordmark",children:e.appName}),r("span",{class:"mark-sub",title:t,children:[e.appSub,t?` \\xB7 ${t}`:""]})]})]}),r("nav",{class:"seg tray","aria-label":e.modesLabel,children:Lo.map(a=>r("button",{type:"button",class:a.id===He.value?"on":"","aria-pressed":a.id===He.value,"aria-disabled":a.id==="insert",title:a.id==="insert"?e.modeLater:void 0,"data-tip":a.id==="insert"?e.modeLater:void 0,onClick:()=>{a.id!=="insert"&&(He.value=a.id)},children:[r(z,{name:a.icon}),i[a.id]]},a.id))}),r("span",{class:"sp"}),r(Do,{}),r("button",{type:"button",class:"round raised-s",onClick:An,disabled:!n.canUndo,title:e.undo,"aria-label":e.undo,"data-testid":"undo",children:r(z,{name:"undo"})}),r("button",{type:"button",class:"round raised-s",onClick:vn,disabled:!n.canRedo,title:e.redo,"aria-label":e.redo,"data-testid":"redo",children:r(z,{name:"redo"})}),r("button",{type:"button",class:"round raised-s",onClick:()=>{ve.value=!0},title:e.exportOpen,"aria-label":e.exportOpen,"aria-haspopup":"dialog","data-testid":"export-open",children:r(z,{name:"export"})}),r("button",{type:"button",class:`round ${ae.value?"pressed is-on":"raised-s"}`,onClick:Nn,"aria-pressed":ae.value,title:ae.value?e.pause:e.play,"aria-label":ae.value?e.pause:e.play,"data-testid":"play",children:r(z,{name:ae.value?"pause":"play"})}),r("button",{type:"button",class:"round raised-s lang",onClick:()=>Sn(te.value==="ar"?"en":"ar"),title:e.langSwitch,"aria-label":e.langSwitch,lang:te.value==="ar"?"en":"ar","data-testid":"lang",children:e.langButton}),r("button",{type:"button",class:"save raised-s",onClick:mt,"aria-disabled":!n.dirty||Ue.value,"data-conflict":ce.value?"":void 0,"data-testid":"save",children:Ue.value?e.saving:e.save})]})}var Po=e=>new Promise(t=>setTimeout(t,e));function xs(){let e=B.value,t=R.value,i=L(t)?.tagName.toLowerCase()==="img",[a,s]=W(""),[o,c]=W("text"),[d,m]=W(null),u=k(0),y=k(t);H(()=>{y.current!==t&&(y.current=t,u.current++,m(null),s(""),i||c("text"))},[t]);let v=b=>{se.value={kind:"error",message:b instanceof Error?b.message:String(b)}},h=async()=>{let b=a.trim();if(!t||!b||d?.status==="running")return;let _=++u.current;try{let x=await P.createAiRequest(b,t,o);if(_!==u.current)return;for(m(x);x.status==="running";){if(await Po(250),x=await P.aiRequest(x.id),_!==u.current)return;m(x)}}catch(x){_===u.current&&v(x)}},T=async()=>{if(d)try{m(await P.rejectAiRequest(d.id))}catch(b){v(b)}},f=async()=>{if(d)try{await ts(d.id),m({...d,status:"accepted"})}catch(b){v(b)}},E=d?.status==="running"?e.aiRunning:d?.status==="ready"?e.aiReady:d?.status==="accepted"?e.aiAccepted:d?.status==="rejected"?e.aiRejected:d?.status==="failed"?e.aiFailed(d.error??""):"";return r("section",{class:"ai-request","aria-labelledby":"ai-request-title","data-testid":"ai-request",children:[r("h2",{id:"ai-request-title",children:e.aiTitle}),r("p",{class:"hint",children:t?e.aiIntro:e.aiSelect}),i&&r("div",{class:"ai-kind tray",role:"group","aria-label":e.aiKind,children:[r("button",{type:"button",class:o==="text"?"on":"","aria-pressed":o==="text",onClick:()=>c("text"),children:e.aiEditElement}),r("button",{type:"button",class:o==="image"?"on":"","aria-pressed":o==="image",onClick:()=>c("image"),children:e.aiRegenerateImage})]}),r("label",{class:"ai-compose",children:[r("span",{class:"lbl",children:e.aiPrompt}),r("textarea",{value:a,maxLength:4e3,disabled:!t||d?.status==="running",placeholder:i&&o==="image"?e.aiImagePlaceholder:e.aiPlaceholder,"data-testid":"ai-prompt",onInput:b=>s(b.currentTarget.value)})]}),r("button",{type:"button",class:"ai-submit raised-s",disabled:!t||!a.trim()||d?.status==="running","data-testid":"ai-submit",onClick:()=>{h()},children:d?.status==="running"?e.aiRunning:e.aiSubmit}),E&&r("p",{class:`ai-status ${d?.status??""}`,role:"status","aria-live":"polite","data-testid":"ai-status",children:E}),d?.status==="ready"&&d.diff&&r("div",{class:"ai-review",children:[r("div",{class:"ai-review-head",children:[r("h3",{children:d.summary||e.aiDiff}),r("span",{children:e.aiDiff})]}),r("pre",{class:"pressed",dir:"ltr","data-testid":"ai-diff",children:r("code",{children:d.diff})}),r("div",{class:"ai-actions",children:[r("button",{type:"button",class:"raised-s","data-testid":"ai-reject",onClick:()=>{T()},children:e.aiReject}),r("button",{type:"button",class:"raised-s accept","data-testid":"ai-accept",onClick:()=>{f()},children:e.aiAccept})]})]})]})}function Mo(e){pe(e.target.slide-1),R.value=e.target.kind==="element"?e.target.key:null,q.value="agent"}function As(){let e=B.value,[t,n]=W(""),[i,a]=W(!1),s=ge.value.notes.filter(v=>v.status==="open"),o=kt.value,c=o==="element"?!!R.value:!!re.value,d=()=>{kt.value="element",re.value=null,_e.value=!1},m=()=>{kt.value="area",re.value=null,_e.value=!0},u=async()=>{let v=t.trim();if(!(!v||!c||i)){a(!0);try{let h=o==="element"?{kind:"element",key:R.value}:{kind:"area",slide:D.value+1,rect:re.value},T=await P.createNote(v,h);ge.value=T.notes,n(""),re.value=null,_e.value=!1}catch(h){se.value={kind:"error",message:h instanceof Error?h.message:String(h)}}finally{a(!1)}}},y=async v=>{try{ge.value=(await P.doneNote(v)).notes}catch(h){se.value={kind:"error",message:h instanceof Error?h.message:String(h)}}};return r("div",{class:"agent-notes","data-testid":"agent-notes",children:[r(xs,{}),r("div",{class:"agent-divider"}),r("p",{class:"hint",children:e.agentIntro}),r("div",{class:"note-target tray",role:"group","aria-label":e.noteText,children:[r("button",{type:"button",class:o==="element"?"on":"","aria-pressed":o==="element","data-testid":"element-target",onClick:d,children:e.noteElement}),r("button",{type:"button",class:o==="area"?"on":"","aria-pressed":o==="area","data-testid":"area-target",onClick:m,children:e.noteArea})]}),r("p",{class:`note-target-help${c?" ready":""}`,children:o==="element"?c?e.noteElement:e.noteSelectElement:re.value?e.noteAreaReady:e.noteDrawArea}),r("label",{class:"note-compose",children:[r("span",{class:"lbl",children:e.noteText}),r("textarea",{value:t,maxLength:4e3,placeholder:e.notePlaceholder,"data-testid":"note-text",onInput:v=>n(v.currentTarget.value)})]}),r("button",{type:"button",class:"note-add raised-s",disabled:!t.trim()||!c||i,"data-testid":"add-note",onClick:()=>{u()},children:[r(z,{name:"plus"}),i?e.addingNote:e.addNote]}),s.length>0?r("section",{class:"note-list","aria-label":e.openNotes,children:[r("h3",{children:e.openNotes}),r("ul",{children:s.map(v=>r("li",{class:"note-row","data-testid":"note-row","data-note-id":v.id,children:[r("button",{type:"button",class:"note-jump",onClick:()=>Mo(v),children:[r("span",{children:v.text}),r("small",{children:[v.target.kind==="element"?e.noteElementTarget(v.target.role):e.noteAreaTarget," \\xB7 ",e.noteOnSlide(v.target.slide)]})]}),r("button",{type:"button",class:"note-done raised-s",onClick:()=>{y(v.id)},children:e.doneNote})]},v.id))})]}):r("p",{class:"hint agent",children:e.agentEmpty})]})}function vs(e,t,n,i,a){let s=n-t,o=s>0&&Number.isFinite(e)?(e-t)/s:0,c=Math.min(1,Math.max(0,o)),d=2*Math.PI*a,m=d*(270/360),u=(135+c*270)*Math.PI/180,y=i/2;return{frac:c,track:m,arc:m*c,circumference:d,marker:{x:y+a*Math.cos(u),y:y+a*Math.sin(u)}}}var In=(e,t,n)=>Math.max(t,Math.min(n,e));function ys(e,t,n,i,a){let s=n.left+n.width/2,o=n.top+n.height/2,c=Math.atan2(t-o,e-s)*180/Math.PI;c<0&&(c+=360),c<135&&(c+=360);let d=In((c-135)/270,0,1);return Math.round((i+d*(a-i))*10)/10}function Cs(e,t,n,i,a){return t==="Home"?i:t==="End"?a:In(e+(t==="ArrowUp"||t==="ArrowRight"?1:t==="ArrowDown"||t==="ArrowLeft"?-1:0)*(n?10:1),i,a)}function Ss(e,t,n,i,a,s){let o=In(e+(i?0:In(t*160,-96,96)),a,s);return jr(o,n)}var On=168,Ei=72,$t=12,Wt=240;function Ns({value:e,unit:t,label:n,stops:i=[],onCommit:a}){let[s,o]=W(e),c=k(null),d=k(null),m=k(null);H(()=>{!d.current&&m.current===null&&o(e)},[e]),H(()=>()=>{m.current!==null&&cancelAnimationFrame(m.current)},[]);let u=vs(s,$t,Wt,On,Ei),y=On/2,v=Number.isInteger(s)?String(s):s.toFixed(1),h=_=>{let x=c.current?.getBoundingClientRect();return x?ys(_.clientX,_.clientY,x,$t,Wt):s},T=_=>{if(!a||!c.current)return;_.preventDefault(),m.current!==null&&(cancelAnimationFrame(m.current),m.current=null),c.current.setPointerCapture(_.pointerId);let x=h(_);d.current={id:_.pointerId,value:x,time:_.timeStamp,velocity:0},o(x),c.current.focus()},f=_=>{let x=d.current;if(!x||x.id!==_.pointerId)return;let C=h(_),M=Math.max(1,_.timeStamp-x.time);x.velocity=(C-x.value)/M,x.value=C,x.time=_.timeStamp,o(C)},E=_=>{let x=d.current;if(!x||x.id!==_.pointerId)return;d.current=null;let C=matchMedia("(prefers-reduced-motion: reduce)").matches,M=Ss(x.value,x.velocity,i,C,$t,Wt);if(C||Math.abs(M-x.value)<.1){o(M),a?.(M);return}let Y=x.value,he=performance.now(),X=A=>{let S=Math.min(1,(A-he)/180),F=1-(1-S)**3;o(Math.round((Y+(M-Y)*F)*10)/10),S<1?m.current=requestAnimationFrame(X):(m.current=null,a?.(M))};m.current=requestAnimationFrame(X)};return r("div",{ref:c,class:"dial raised",role:"slider",tabIndex:a?0:-1,"aria-label":n,"aria-valuemin":$t,"aria-valuemax":Wt,"aria-valuenow":s,"data-testid":"dial",onPointerDown:T,onPointerMove:f,onPointerUp:E,onPointerCancel:E,onKeyDown:_=>{if(!a||!["ArrowUp","ArrowRight","ArrowDown","ArrowLeft","Home","End"].includes(_.code))return;_.preventDefault(),m.current!==null&&(cancelAnimationFrame(m.current),m.current=null);let x=Cs(s,_.code,_.shiftKey,$t,Wt);o(x),a(x)},children:[r("svg",{viewBox:`0 0 ${On} ${On}`,"aria-hidden":"true",children:[r("defs",{children:r("linearGradient",{id:"nm-dial-g",x1:"0",y1:"1",x2:"1",y2:"0",children:[r("stop",{offset:"0","stop-color":"#4cc9f0"}),r("stop",{offset:".55","stop-color":"#a8d98a"}),r("stop",{offset:"1","stop-color":"#ff8a4c"})]})}),r("circle",{cx:y,cy:y,r:Ei,class:"dial-track","stroke-dasharray":`${u.track} ${u.circumference}`,transform:`rotate(135 ${y} ${y})`}),u.arc>.5&&r("circle",{cx:y,cy:y,r:Ei,class:"dial-arc","stroke-dasharray":`${u.arc} ${u.circumference}`,transform:`rotate(135 ${y} ${y})`}),r("circle",{cx:u.marker.x,cy:u.marker.y,r:"6",class:"dial-marker"})]}),r("div",{class:"knob raised-s",children:r("div",{children:[r("span",{class:`read dial-value${v.length>3?" long":""}`,"data-testid":"font-size",children:v}),r("small",{children:t})]})})]})}var Tt=(e,t=0)=>{let n=10**t;return Math.round(e*n)/n};function Ti(e){let t=/rgba?\\(\\s*([\\d.]+)[ ,]+([\\d.]+)[ ,]+([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)/.exec(e);return!t||(t[4]===void 0?1:t[4].endsWith("%")?Number(t[4].slice(0,-1))/100:Number(t[4]))===0?null:"#"+[t[1],t[2],t[3]].map(i=>Math.max(0,Math.min(255,Math.round(Number(i)))).toString(16).padStart(2,"0")).join("")}function gi(e,t=""){let n=new Map;if(!e||typeof e!="object")return n;for(let[i,a]of Object.entries(e)){let s=i==="DEFAULT"?t:t?`${t}-${i}`:i;if(typeof a=="string")n.set(s,a);else for(let[o,c]of gi(a,s))n.set(o,c)}return n}var Pe=null;function wo(e){return Pe||(Pe=document.createElement("span"),Pe.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden",Pe.setAttribute("aria-hidden","true"),document.body.appendChild(Pe)),Pe.style.color="",Pe.style.color=e,Pe.style.color?Ti(getComputedStyle(Pe).color):null}function ks(e,t,n=0){return n>5?e:e.replace(/var\\(\\s*(--[\\w-]+)\\s*(?:,\\s*([^)]+))?\\)/g,(i,a,s)=>{let o=t.getPropertyValue(a).trim()||s?.trim()||"";return ks(o,t,n+1)})}function Rs(e,t,n){let i=e.tailwind,a=new Map([...gi(i?.config?.theme?.colors),...gi(i?.config?.theme?.extend?.colors)]),s=e.getComputedStyle(t),o=[];for(let c of n.tokens.colors){let d=a.get(c);if(!d)continue;let m=wo(ks(d,s));m&&o.push({token:c,hex:m})}return o}var Bo=/^-?(left|right|top|bottom|inset|inset-x|inset-y|start|end)-/;function Fo(e){let t=new Set;for(let n of Array.from(e.classList)){if(n.includes(":"))continue;let i=Bo.exec(n);if(!i)continue;let a=i[1];a==="inset"?["left","right","top","bottom"].forEach(s=>t.add(s)):a==="inset-x"?(t.add("left"),t.add("right")):a==="inset-y"?(t.add("top"),t.add("bottom")):t.add(a)}return t}function Is(e){let t=e.closest(".slide");return t?Array.from(e.ownerDocument.querySelectorAll(".slide")).indexOf(t):-1}var Os=e=>Array.from(e.childNodes).some(t=>t.nodeType===3&&(t.textContent??"").trim());function Ho(e){if(Os(e))return[e];let t=[],n=i=>{for(let a of Array.from(i.children))Os(a)&&a.hasAttribute("data-nm-key")?t.push(a):n(a)};return n(e),t.length?t:[e]}function Ls(e,t,n,i,a,s){let o=Ho(t),c=o.map(me=>me.getAttribute("data-nm-key")??n),d=me=>{let I=e.getComputedStyle(me);return[I.fontFamily,I.fontSize,I.fontWeight,I.color].join("|")},m=new Set(o.map(d)).size>1,u=e.getComputedStyle(t),y=o[0]===t?u:e.getComputedStyle(o[0]),v=(t.textContent??"").replace(/\\s+/g," ").trim(),h=v.length>0&&!["img","svg","iframe","video","canvas","picture"].includes(t.localName),T=Tt(parseFloat(y.fontSize)||0,1),f=parseFloat(y.lineHeight),E=Ti(u.backgroundColor),b=h?"color":E?"background-color":null,_=b==="color"?Ti(y.color):b?E:null,x=b&&_?{prop:b,hex:_,token:a.find(me=>me.hex===_)?.token??null}:null,C=u.position==="absolute"||u.position==="fixed",M=Fo(t),Y=me=>Tt(parseFloat(me)||0),he=null,X=null;C&&(he=(M.has("right")&&!M.has("left")?!0:M.has("left")&&!M.has("right")?!1:s)?{side:"right",px:Y(u.right)}:{side:"left",px:Y(u.left)},X=M.has("bottom")&&!M.has("top")?{side:"bottom",px:Y(u.bottom)}:{side:"top",px:Y(u.top)});let A=t.getBoundingClientRect(),S=t,F=Tt(typeof S.offsetWidth=="number"?S.offsetWidth:A.width),Q=Tt(typeof S.offsetHeight=="number"?S.offsetHeight:A.height),J=null;for(let[me,I]of Object.entries(i.morph)){if(!I.includes(n))continue;let it=t.ownerDocument,rt=Is(t),Ne=I.filter(ue=>ue!==n).map(ue=>{let We=it.querySelector(`[data-nm-key="${ue}"]`);return We?Is(We):-1}).filter(ue=>ue>=0&&ue!==rt).map(ue=>ue+1);J={group:me,slides:[...new Set(Ne)].sort((ue,We)=>ue-We)};break}return{key:n,typoKeys:c,typoMixed:m,text:v,hasText:h,fontSize:T,fontFamily:y.fontFamily.split(",")[0].trim().replace(/^[\'"]|[\'"]$/g,""),fontWeight:Number(y.fontWeight)||400,lineHeight:Number.isFinite(f)&&T>0?Tt(f/T,2):null,opacity:Tt(Number(u.opacity),2),colour:x,positioned:C,x:he,y:X,width:F,height:Q,morph:J}}var kn=[300,400,700,900],Ds=e=>kn.reduce((t,n)=>Math.abs(n-e)<Math.abs(t-e)?n:t,kn[0]);var _i=new Set(["span","b","strong","i","em","small","sup","sub","a","mark","u","br","bdi","bdo","code","abbr","time","s","q"]),Uo=new Set(["img","picture","video","canvas"]),zo=new Set(["iframe","object","embed"]);function Ps(e){return e.isSlide?"slide":e.tag==="h1"||e.tag==="h2"?e.firstHeading?"mainTitle":"heading":/^h[3-6]$/.test(e.tag)?"heading":Uo.has(e.tag)?"image":zo.has(e.tag)?"figure":e.tag==="svg"?e.childTags.includes("image")?"image":"shape":e.childTags.length>0?e.hasText&&e.childTags.every(t=>_i.has(t))?"text":"group":e.hasText?"text":"shape"}var tt=(e,t)=>({mainTitle:t.roleMainTitle,heading:t.roleHeading,text:t.roleText,image:t.roleImage,figure:t.roleFigure,group:t.roleGroup,shape:t.roleShape,slide:t.roleSlide})[e],Kt=e=>e.localName.toLowerCase(),Ms=e=>e.closest(".slide");function Gt(e){let n=Ms(e)?.querySelector("h1, h2")??null;return Ps({tag:Kt(e),isSlide:e.classList.contains("slide"),hasText:(e.textContent??"").trim().length>0,childTags:Array.from(e.children).map(Kt),firstHeading:n===e})}function et(e){if(e.classList.contains("slide"))return null;let t=e.parentElement;for(;t&&!t.hasAttribute("data-nm-key");)t=t.parentElement;return t&&Ms(t)?t:null}function Yo(e){let t=et(e);if(!t||t.classList.contains("slide"))return null;let n=t.ownerDocument.defaultView;if(!n||n.getComputedStyle(t).position!=="absolute")return null;let i=e.getBoundingClientRect(),a=t.getBoundingClientRect(),s=(o,c)=>Math.abs(o-c)<=Math.max(2,.08*Math.max(Math.abs(o),Math.abs(c)));return s(i.width,a.width)&&s(i.height,a.height)&&Math.abs(i.left-a.left)<=.08*a.width&&Math.abs(i.top-a.top)<=.08*a.height?t:null}function Rn(e){if(Kt(e)==="img"){let n=Yo(e);if(n)return n}let t=e;for(;;){if(!_i.has(Kt(t)))return t;let n=et(t);if(!n||n.classList.contains("slide"))return t;let i=Array.from(n.children);if(!(n.textContent??"").trim()||!i.every(a=>_i.has(Kt(a))))return t;t=n}}function ws(e,t){if(e===t||!e.contains(t))return null;let n=t;for(;n&&et(n)!==e;)n=et(n);return n}function Bs(e){let t=[];for(let n=e;n;n=et(n))t.unshift(n);return t}function Fs(e){let t=new Map,n=!1,i=(a,s)=>{let o=a.tag==="h1"||a.tag==="h2",c=o&&!n;o&&(n=!0),t.set(a,Ps({tag:a.tag,isSlide:s&&a.classes.includes("slide"),hasText:a.text.trim().length>0,childTags:a.children.map(d=>d.tag),firstHeading:c})),a.children.forEach(d=>i(d,!1))};return i(e,!0),t}var Hs=null;async function Us(e,t=!1){if(Ae.value=null,!e||e.cancelled||!e.changed){ke();return}await K([{kind:"setText",id:e.key,text:e.text}],{label:"Edit text",coalesceKey:`text:${e.key}:${Date.now()}`}),t&&await mt()}function $o(){let e=pt();!e||e===Hs||(Hs=e,e.addEventListener("nm-text-command",(t=>{Us(t.detail.result,t.detail.save).catch(()=>{})})))}function zs(e){return $o(),de()?.beginText(e)??null?(R.value=e,Ae.value=e,ke(),!0):!1}async function nt(e=!0){await Us(de()?.endText(e)??null)}var Ys=(e,t,n,i)=>{if(!Number.isFinite(e))throw new Error(`${i} must be finite`);return Math.max(t,Math.min(n,Math.round(e)))};function $s(e,t){let n=t.kind.trim().toLowerCase();if(!/^[a-z][a-z0-9-]*$/.test(n))throw new Error("entrance kind must be a safe identifier");return[{kind:"setAttr",id:e,name:"data-entrance",value:n},{kind:"setAttr",id:e,name:"data-entrance-order",value:String(Ys(t.order,1,999,"entrance order"))},{kind:"setAttr",id:e,name:"data-entrance-delay",value:String(Ys(t.delay,0,6e4,"entrance delay"))}]}var Wo=e=>e.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);function Ws(e){if(e.toSlide!==e.fromSlide+1)throw new Error("Morph pairs must connect consecutive slides");let t=Wo(e.group);if(!t)throw new Error("Morph group must contain a letter or number");let n=new Set(e.existingGroups),i=t;for(let a=2;n.has(i);a++)i=`${t}-${a}`;return[{kind:"setAttr",id:e.fromKey,name:"data-morph",value:i},{kind:"setAttr",id:e.toKey,name:"data-morph",value:i}]}function bi(e){return e.flatMap((t,n)=>[{kind:"setAttr",id:t.key,name:"data-zoom-step",value:String(n+1)},{kind:"setAttr",id:t.key,name:"data-zoom-label",value:t.label?.trim()||null}])}function Ks(e,t){if(!/^[A-Za-z0-9_-]+$/.test(e))throw new Error("identity colour token is invalid");let n=t.trim();if(!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(n))throw new Error("identity colour must be a six- or eight-digit hex value");return{kind:"setToken",path:["colors",e],value:n}}function Gs(e,t){let n=t.trim();if(!n||/[\\r\\n]/.test(n))throw new Error("identity font value is invalid");return{kind:"setToken",path:["fontFamily",e],value:n}}function Xs(e,t,n){if(!/^--anatomy-[a-z0-9-]+$/i.test(t))throw new Error("anatomy variables must start with --anatomy-");let i=n.trim();if(!/^#[0-9a-f]{3,8}$/i.test(i))throw new Error("unsafe anatomy CSS colour value");return{kind:"setStyle",id:e,prop:t,value:i}}var Qs={ar:{motion:"\\u0627\\u0644\\u062D\\u0631\\u0643\\u0629",select:"\\u062D\\u062F\\u0651\\u062F \\u0639\\u0646\\u0635\\u0631\\u064B\\u0627 \\u0641\\u064A \\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0644\\u062A\\u062D\\u0631\\u064A\\u0631 \\u062D\\u0631\\u0643\\u062A\\u0647.",entrance:"\\u062F\\u062E\\u0648\\u0644 \\u0627\\u0644\\u0639\\u0646\\u0635\\u0631",kind:"\\u0646\\u0648\\u0639 \\u0627\\u0644\\u062F\\u062E\\u0648\\u0644",order:"\\u0627\\u0644\\u062A\\u0631\\u062A\\u064A\\u0628",delay:"\\u0627\\u0644\\u062A\\u0623\\u062E\\u064A\\u0631 (ms)",previewEntrance:"\\u0645\\u0639\\u0627\\u064A\\u0646\\u0629 \\u0627\\u0644\\u062F\\u062E\\u0648\\u0644",morph:"\\u0631\\u0628\\u0637 Morph \\u0628\\u0627\\u0644\\u0634\\u0631\\u064A\\u062D\\u0629 \\u0627\\u0644\\u062A\\u0627\\u0644\\u064A\\u0629",target:"\\u0627\\u0644\\u0639\\u0646\\u0635\\u0631 \\u0627\\u0644\\u0645\\u0642\\u0627\\u0628\\u0644",link:"\\u0625\\u0646\\u0634\\u0627\\u0621 \\u0627\\u0644\\u0631\\u0628\\u0637",zoom:"\\u062E\\u0637\\u0648\\u0627\\u062A Zoom",addZoom:"\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0627\\u0644\\u0645\\u062D\\u062F\\u062F \\u0643\\u062E\\u0637\\u0648\\u0629",preview:"\\u0645\\u0639\\u0627\\u064A\\u0646\\u0629",up:"\\u0644\\u0623\\u0639\\u0644\\u0649",down:"\\u0644\\u0623\\u0633\\u0641\\u0644",label:"\\u0627\\u0644\\u062A\\u0633\\u0645\\u064A\\u0629",anatomy:"\\u0623\\u0644\\u0648\\u0627\\u0646 anatomy",identity:"\\u0647\\u0648\\u064A\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636",colours:"\\u0627\\u0644\\u0623\\u0644\\u0648\\u0627\\u0646",fonts:"\\u062B\\u0646\\u0627\\u0626\\u064A\\u0629 \\u0627\\u0644\\u062E\\u0637\\u0648\\u0637",body:"\\u062E\\u0637 \\u0627\\u0644\\u0646\\u0635",display:"\\u062E\\u0637 \\u0627\\u0644\\u0639\\u0646\\u0627\\u0648\\u064A\\u0646",noConfig:"\\u0644\\u0627 \\u064A\\u062D\\u062A\\u0648\\u064A \\u0627\\u0644\\u0639\\u0631\\u0636 \\u0639\\u0644\\u0649 tailwind.config \\u0642\\u0627\\u0628\\u0644 \\u0644\\u0644\\u062A\\u062D\\u0631\\u064A\\u0631.",noNext:"\\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F \\u0634\\u0631\\u064A\\u062D\\u0629 \\u062A\\u0627\\u0644\\u064A\\u0629 \\u0644\\u0631\\u0628\\u0637 Morph."},en:{motion:"Motion",select:"Select an element on the slide to edit its motion.",entrance:"Element entrance",kind:"Entrance type",order:"Order",delay:"Delay (ms)",previewEntrance:"Preview entrance",morph:"Morph to next slide",target:"Matching element",link:"Create link",zoom:"Zoom steps",addZoom:"Add selection as step",preview:"Preview",up:"Move up",down:"Move down",label:"Label",anatomy:"Anatomy colours",identity:"Deck identity",colours:"Colours",fonts:"Font pairing",body:"Body font",display:"Display font",noConfig:"This deck has no editable tailwind.config.",noNext:"There is no next slide for a Morph pair."}};function Ko(e){if(!e)return[];let t=[],n=i=>{i.key&&t.push({key:i.key,name:i.text.trim().slice(0,60)||`<${i.tag}>`}),i.children.forEach(n)};return e.children.forEach(n),t}function Go(e,t,n){return xn(()=>{let i=le.value?.entrances.find(s=>s.key===e),a={kind:i?.kind??"fade-up",order:i?.order??1,delay:i?.delay??0,[t]:n};return $s(e,a)},{label:"Set entrance",coalesceKey:`entrance:${e}`})}function xi(e){let{value:t,onCommit:n,type:i="text",...a}=e,[s,o]=W(null),c=k(t);H(()=>{c.current!==t&&(c.current=t,o(null))},[t]);let d={...a,value:s??t,onInput:m=>o(m.currentTarget.value),onChange:m=>{o(m.currentTarget.value),n(m.currentTarget.value)}};return i==="number"?r("input",{type:"number",...d}):r("input",{type:"text",...d})}function Vs(){let e=le.value,t=R.value,n=D.value,i=Qs[te.value],[a,s]=W(null),[o,c]=W("");if(H(()=>{let f=!0;return s(null),!e||n+1>=e.slides.length?()=>{f=!1}:(P.outline(n+2).then(E=>{f&&s(E.outline)}).catch(()=>{}),()=>{f=!1})},[n,e?.slides.length,e?.runtime.version]),!e)return null;let d=e.entrances.find(f=>f.key===t),m=e.zoomSteps.filter(f=>f.slideKey===e.slides[n]?.key).sort((f,E)=>f.step-E.step),u=e.anatomy.find(f=>f.key===t),y=(()=>{if(!u)return{};let f={...u.variables},E=L(u.key);if(E?.tagName==="IFRAME")try{E.contentDocument?.querySelectorAll("[style]").forEach(b=>{for(let _=0;_<b.style.length;_++){let x=b.style[_];/^--anatomy-/.test(x)&&!(x in f)&&(f[x]=b.style.getPropertyValue(x).trim())}})}catch{}return f})(),v=Ko(a),h=(f,E)=>{t&&Go(t,f,E)},T=(f,E)=>{let b=[...m],_=Math.max(0,Math.min(b.length-1,f+E));if(_===f)return;let[x]=b.splice(f,1);b.splice(_,0,x),K(bi(b),{label:"Reorder zoom steps"})};return r("div",{class:"phase7-panel","data-testid":"motion-panel",children:[r("h2",{children:i.motion}),t?r($,{children:[r("fieldset",{children:[r("legend",{children:i.entrance}),r("label",{children:[i.kind,r("select",{value:d?.kind??"fade-up",onChange:f=>h("kind",f.currentTarget.value),children:[r("option",{value:"fade-up",children:"fade-up"}),r("option",{value:"fade",children:"fade"}),r("option",{value:"scale",children:"scale"}),r("option",{value:"slide-right",children:"slide-right"})]})]}),r("label",{children:[i.order,r(xi,{type:"number",min:"1",value:String(d?.order??1),onCommit:f=>h("order",Number(f))},`order:${t}`)]}),r("label",{children:[i.delay,r(xi,{type:"number",min:"0",step:"50",value:String(d?.delay??0),onCommit:f=>h("delay",Number(f))},`delay:${t}`)]}),r("button",{type:"button",class:"raised-s",onClick:()=>de()?.previewEntrance(n),children:i.previewEntrance})]}),r("fieldset",{children:[r("legend",{children:i.morph}),n+1>=e.slides.length?r("p",{class:"hint",children:i.noNext}):r($,{children:[r("label",{children:[i.target,r("select",{value:o,onChange:f=>c(f.currentTarget.value),children:[r("option",{value:""}),v.map(f=>r("option",{value:f.key,children:f.name}))]})]}),r("button",{type:"button",class:"raised-s",disabled:!o,onClick:()=>{if(!o)return;let f=`morph-${n+1}-${Object.keys(e.morph).length+1}`;K(Ws({fromKey:t,toKey:o,fromSlide:n+1,toSlide:n+2,group:f,existingGroups:Object.keys(e.morph)}),{label:"Pair Morph elements"})},children:i.link})]})]})]}):r("p",{class:"hint",children:i.select}),r("fieldset",{children:[r("legend",{children:i.zoom}),t&&!m.some(f=>f.key===t)&&r("button",{type:"button",class:"raised-s",onClick:()=>{K(bi([...m.map(f=>({key:f.key,label:f.label})),{key:t,label:null}]),{label:"Add zoom step"})},children:i.addZoom}),r("ol",{class:"motion-list",children:m.map((f,E)=>r("li",{children:[r(xi,{"aria-label":i.label,value:f.label??"",onCommit:b=>{K([{kind:"setAttr",id:f.key,name:"data-zoom-label",value:b||null}],{label:"Label zoom step",coalesceKey:`zoom-label:${f.key}`})}}),r("button",{type:"button","aria-label":i.up,onClick:()=>T(E,-1),children:"\\u2191"}),r("button",{type:"button","aria-label":i.down,onClick:()=>T(E,1),children:"\\u2193"}),r("button",{type:"button",onClick:()=>de()?.previewZoom(n,E+1),children:i.preview})]},f.key))})]}),u&&Object.keys(y).length>0&&r("fieldset",{"data-testid":"anatomy-controls",children:[r("legend",{children:i.anatomy}),Object.entries(y).map(([f,E])=>r("label",{children:[f,r("input",{type:"color",value:/^#[0-9a-f]{6}$/i.test(E)?E:"#000000",onChange:b=>{K([Xs(u.key,f,b.currentTarget.value)],{label:`Set ${f}`})}})]},f))]})]})}function Ln(e){return Array.isArray(e)?e.join(", "):typeof e=="string"?e:""}function js(){let e=le.value,t=Qs[te.value];if(!e)return null;let n=Object.entries(e.identity.colours).filter(s=>typeof s[1]=="string"),i=e.fonts.map(s=>s.family),a=(s,o)=>{K([s],{label:o})};return r("div",{class:"phase7-panel","data-testid":"identity-panel",children:[r("h2",{children:t.identity}),e.tokens.colors.length===0&&e.tokens.fontFamilies.length===0?r("p",{class:"hint",children:t.noConfig}):r($,{children:[r("fieldset",{children:[r("legend",{children:t.colours}),r("div",{class:"identity-colours",children:n.map(([s,o])=>r("label",{children:[r("span",{children:s}),r("input",{type:"color",value:/^#[0-9a-f]{6}$/i.test(o)?o:"#000000",onChange:c=>a(Ks(s,c.currentTarget.value),`Set identity colour ${s}`)})]},s))})]}),r("fieldset",{children:[r("legend",{children:t.fonts}),["body","display"].map(s=>r("label",{children:[t[s],r("select",{value:Ln(e.identity.fonts[s]),onChange:o=>a(Gs(s,o.currentTarget.value),`Set ${s} font`),children:[r("option",{value:Ln(e.identity.fonts[s]),children:Ln(e.identity.fonts[s])||"\\u2014"}),i.filter(o=>o!==Ln(e.identity.fonts[s])).map(o=>r("option",{value:o,children:o}))]})]},s))]})]})]})}function Dn({label:e,value:t,shown:n,min:i,max:a,step:s,testid:o,onChange:c}){let d=t===null?0:Math.min(1,Math.max(0,(t-i)/(a-i)));return r("div",{class:"sl",role:"meter","aria-label":e,"aria-valuemin":i,"aria-valuemax":a,"aria-valuenow":t??void 0,"aria-valuetext":n,children:[r("div",{class:"h",children:[r("span",{children:e}),r("span",{class:"read","data-testid":o,children:n})]}),r("div",{class:"track pressed",children:[r("span",{class:"fill",style:{inlineSize:`calc(${d*100}% - 4px)`}}),r("span",{class:"thumb raised-s",style:{insetInlineStart:`calc(${d*100}% - ${d*26}px)`},children:r("i",{})}),c&&r("input",{"aria-label":e,type:"range",min:i,max:a,step:s??.01,value:t??i,onChange:m=>c(Number(m.currentTarget.value))})]})]})}var Xo=(e,t)=>({300:t.weightLight,400:t.weightRegular,700:t.weightBold,900:t.weightBlack})[e];function gt(e){let{value:t,onCommit:n,...i}=e,a=k(!1),s=k(null);return H(()=>{!a.current&&s.current&&(s.current.value=String(t))},[t]),r("input",{...i,ref:s,type:"number",defaultValue:String(t),onFocus:()=>{a.current=!0},onBlur:()=>{a.current=!1,s.current&&(s.current.value=String(t))},onChange:o=>n(Number(o.currentTarget.value))})}function Qo(e,t){let n=e.message.split(/[\\s:]/)[0];switch(e.code){case"alpha-on-var-color":return t.lintAlpha(n);case"letter-spacing-arabic":return t.lintLetterSpacing(n);case"mixed-digits":return t.lintMixedDigits;case"missing-font-weight":return t.lintMissingWeight(n);case"missing-asset":return t.lintMissingAsset(e.message.replace(/^asset not found:\\s*/,""));case"emoji":return t.lintEmoji;case"slide-relative":return t.lintSlideRelative;default:return e.message}}function qs({items:e}){let t=B.value;return e.length?r("div",{class:"fix pressed",role:"group","aria-label":t.issuesLabel,"data-testid":"issues",children:[r(z,{name:"warn"}),r("ul",{children:e.map((n,i)=>r("li",{children:r("bdi",{children:Qo(n,t)})},i))})]}):null}function Vo({el:e}){let t=B.value,n=Bs(e);return r("nav",{class:"crumbs","aria-label":t.breadcrumbLabel,"data-testid":"breadcrumb",children:n.map((i,a)=>{let s=i.getAttribute("data-nm-key")??"",o=a===n.length-1,c=i.classList.contains("slide")?t.slideN(D.value+1):tt(Gt(i),t);return r("span",{class:"crumb",children:o?r("span",{"aria-current":"location",children:c}):r("button",{type:"button",onClick:()=>Ee(s),children:c})},s)})})}function jo(){let e=B.value,t=te.value;Ve.value,oe.value;let n=R.value,i=L(n),a=pt(),s=le.value,o=D.value+1,c=Oe.value.filter(A=>A.nodeKey===s?.slides[D.value]?.key);if(!n||!i||!a||!s)return r("div",{class:"props empty",children:[r("div",{class:"el",children:[r("div",{class:"lbl",children:e.slideN(o)}),r("div",{class:"t",children:qe(D.value)??e.untitled})]}),r("p",{class:"hint",children:e.noSelection}),r(qs,{items:c})]});let d=t==="ar",m=Rs(a,i,s),u=Ls(a,i,n,s,m,d),y=Gt(i),v=u.text?u.text.slice(0,70):tt(y,e),h=Ds(u.fontWeight),T={right:e.fromRight,left:e.fromLeft,top:e.fromTop,bottom:e.fromBottom},f=Oe.value.filter(A=>A.nodeKey===n),E=[...new Set([u.fontFamily,...s.fonts.map(A=>A.family)])],b=Vr(Array.from(a.document.querySelectorAll("[data-nm-key]")).map(A=>parseFloat(a.getComputedStyle(A).fontSize))),_=["fontFamily","fontSize","fontWeight","textColour","lineHeight"],x=(A,S)=>{let F=_.includes(A)?u.typoKeys:[n];nt(!0).then(()=>K(F.map(Q=>Qr(Q,A,S)),{label:`Set ${A}`,coalesceKey:`property:${n}:${A}`})).catch(Q=>{se.value={kind:"error",message:Q instanceof Error?Q.message:String(Q)}})},C=a.getComputedStyle(i),M=A=>Number.parseFloat(A)||0,Y=(A,S)=>{nt(!0).then(()=>as(n,A,S)).catch(F=>{se.value={kind:"error",message:F instanceof Error?F.message:String(F)}})},he=i.tagName.toLowerCase()==="img",X=C.objectPosition.match(/([\\d.]+)%\\s+([\\d.]+)%/);return r("div",{class:"props","data-testid":"props","data-key":n,children:[r(Vo,{el:i}),r("div",{class:"el",children:[r("div",{class:"lbl",children:[tt(y,e)," \\xB7 ",e.slideN(o)]}),r("div",{class:"t","data-testid":"element-name",children:v}),u.hasText&&u.typoMixed&&r("div",{class:"lbl","data-testid":"typo-mixed",children:e.typoMixed})]}),u.hasText&&r("div",{class:"dialrow",children:[r(Ns,{value:u.fontSize,unit:e.sizeUnit,label:e.sizeLabel,stops:b,onCommit:A=>x("fontSize",A)},n),r("div",{class:"side",children:[r("label",{class:"font-select lbl",children:[r("span",{children:e.fontFamily}),r("select",{"aria-label":e.fontFamily,value:u.fontFamily,"data-testid":"font-family",onChange:A=>x("fontFamily",A.currentTarget.value),children:E.map(A=>r("option",{value:A,children:Tr(A,t)},A))})]}),r("div",{class:"wt",role:"group","aria-label":e.weightLabel,"data-testid":"weight","data-weight":u.fontWeight,children:kn.map(A=>r("button",{type:"button",class:A===h?"on":"raised-s","aria-pressed":A===h,onClick:()=>x("fontWeight",A),children:Xo(A,e)},A))})]})]}),u.colour&&r("div",{class:"colours",children:[r("div",{class:"lbl","data-testid":"colour-label",children:[u.colour.prop==="color"?e.textColour:e.fillColour," \\xB7 ",u.colour.token?e.colourFromDeck(Ot(u.colour.token,t)):e.colourOutside(u.colour.hex)]}),r("div",{class:"sw",role:"group","aria-label":e.deckColours,"data-testid":"swatches","data-hex":u.colour.hex,children:m.slice(0,8).map(A=>{let S=A.token===u.colour?.token;return r("button",{type:"button","data-token":A.token,class:S?"on":"raised-s",title:Ot(A.token,t),"aria-label":Ot(A.token,t),"aria-pressed":S,onClick:()=>x(u.colour?.prop==="color"?"textColour":"fillColour",A.token),children:r("i",{style:{background:A.hex}})},A.token)})})]}),u.hasText&&r(Dn,{label:e.lineHeight,value:u.lineHeight,shown:u.lineHeight===null?e.lineHeightNormal:u.lineHeight.toFixed(2),min:.6,max:2.4,step:.05,testid:"line-height",onChange:A=>x("lineHeight",A)}),r(Dn,{label:e.opacity,value:u.opacity,shown:`${Math.round(u.opacity*100)}${t==="ar"?"\\u066A":"%"}`,min:0,max:1,step:.05,testid:"opacity",onChange:A=>x("opacity",A)}),r("fieldset",{class:"full-props","data-testid":"full-properties",children:[r("legend",{class:"lbl",children:e.spacing}),r("div",{class:"prop-grid",children:[r("label",{children:[r("span",{children:e.padding}),r(gt,{min:"0",max:"240",value:M(C.paddingTop),onCommit:A=>Y("padding",A)})]}),r("label",{children:[r("span",{children:e.margin}),r(gt,{min:"0",max:"240",value:Math.max(0,M(C.marginTop)),onCommit:A=>Y("margin",A)})]}),r("label",{children:[r("span",{children:e.radius}),r(gt,{min:"0",max:"240",value:M(C.borderTopLeftRadius),onCommit:A=>Y("radius",A)})]}),r("label",{children:[r("span",{children:e.borderWidth}),r(gt,{min:"0",max:"32",value:M(C.borderTopWidth),onCommit:A=>Y("borderWidth",A)})]}),r("label",{children:[r("span",{children:e.shadow}),r("select",{"aria-label":e.shadow,onChange:A=>Y("shadow",A.currentTarget.value),children:[r("option",{value:"none",children:e.shadowNone}),r("option",{value:"sm",children:"S"}),r("option",{value:"md",children:"M"}),r("option",{value:"lg",children:"L"}),r("option",{value:"xl",children:"XL"})]})]}),r("label",{children:[r("span",{children:e.borderColour}),r("select",{"aria-label":e.borderColour,onChange:A=>Y("borderColour",A.currentTarget.value),children:m.map(A=>r("option",{value:A.token,children:Ot(A.token,t)}))})]})]})]}),he&&r("fieldset",{class:"image-props","data-testid":"image-properties",children:[r("legend",{class:"lbl",children:e.imageFit}),r("div",{class:"segmented tray",role:"group","aria-label":e.imageFit,children:[r("button",{type:"button",onClick:()=>{zt(n,{fit:"cover"})},children:e.imageCover}),r("button",{type:"button",onClick:()=>{zt(n,{fit:"contain"})},children:e.imageContain})]}),r(Dn,{label:e.focalX,value:Number(X?.[1]??50),shown:`${Math.round(Number(X?.[1]??50))}%`,min:0,max:100,step:1,testid:"focal-x",onChange:A=>{zt(n,{focalX:A})}}),r(Dn,{label:e.focalY,value:Number(X?.[2]??50),shown:`${Math.round(Number(X?.[2]??50))}%`,min:0,max:100,step:1,testid:"focal-y",onChange:A=>{zt(n,{focalY:A})}}),r("label",{class:"upload raised-s",children:[e.replaceImage,r("input",{type:"file",accept:"image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml",onChange:A=>{let S=A.currentTarget.files?.[0];S&&ds(n,S)}})]})]}),r("div",{class:"pos",role:"group","aria-label":e.positionLabel,children:[u.x&&u.y?r($,{children:[r("label",{class:"cell raised-s",children:[r("small",{children:T[u.x.side]}),r(gt,{class:"read",step:"1",value:u.x.px,"data-testid":"pos-x","data-side":u.x.side,onCommit:A=>x(u.x.side,A)})]}),r("label",{class:"cell raised-s",children:[r("small",{children:T[u.y.side]}),r(gt,{class:"read",step:"1",value:u.y.px,"data-testid":"pos-y","data-side":u.y.side,onCommit:A=>x(u.y.side,A)})]})]}):r("div",{class:"cell wide raised-s",children:[r("small",{children:e.positionLabel}),r("span",{class:"flow",children:e.inFlow}),r("button",{type:"button",class:"free-position","data-testid":"free-position",onClick:()=>{ss()},children:e.freePosition})]}),r("div",{class:"cell raised-s",children:[r("small",{children:e.width}),r("span",{class:"read","data-testid":"size-w",children:u.width})]}),r("div",{class:"cell raised-s",children:[r("small",{children:e.height}),r("span",{class:"read","data-testid":"size-h",children:u.height})]})]}),u.morph&&u.morph.slides.length>0&&r("div",{class:"tg",children:r("div",{class:"on","data-testid":"morph",children:[r("span",{children:[r(z,{name:"link"}),e.morphLinked]}),r("small",{children:e.morphWith(u.morph.slides)})]})}),r(qs,{items:f})]})}function qo(){let e=B.value,[t,n]=W(null),i=D.value,a=oe.value;if(H(()=>{let d=!0;return P.outline(i+1).then(m=>{d&&n(m.outline)}).catch(()=>{d&&n(null)}),()=>{d=!1}},[i,a]),!t)return r("p",{class:"hint",children:e.layersEmpty});let s=Fs(t),o=[],c=(d,m)=>{d.key&&(o.push({n:d,depth:m}),d.tag!=="svg"&&d.children.forEach(u=>c(u,m+1)))};return t.children.forEach(d=>c(d,0)),o.length?r("ul",{class:"layers","aria-label":e.layersLabel,"data-testid":"layers",children:o.map(({n:d,depth:m})=>{let u=d.key===R.value;return r("li",{class:"layer-row",children:[r("button",{type:"button",class:u?"on":"","aria-current":u?"true":void 0,style:{paddingInlineStart:`${10+m*14}px`},onMouseEnter:()=>{ie.value=d.key??null},onMouseLeave:()=>{ie.value=null},onFocus:()=>{ie.value=d.key??null},onBlur:()=>{ie.value=null},onClick:()=>Ee(d.key??null),"data-key":d.key,children:[r("span",{class:"role",children:tt(s.get(d)??"group",e)}),d.text&&r("span",{class:"snip",children:d.text})]}),r("span",{class:"layer-actions",children:[r("button",{type:"button",title:e.layerUp,"aria-label":e.layerUp,onClick:()=>{ui(d.key,1)},children:r(z,{name:"chevronUp"})}),r("button",{type:"button",title:e.layerDown,"aria-label":e.layerDown,onClick:()=>{ui(d.key,-1)},children:r(z,{name:"chevronDown"})}),r("button",{type:"button",title:d.classes.includes("hidden")?e.layerShow:e.layerHide,"aria-label":d.classes.includes("hidden")?e.layerShow:e.layerHide,onClick:()=>{os(d.key,!d.classes.includes("hidden"))},children:r(z,{name:d.classes.includes("hidden")?"eye":"eyeOff"})})]})]},d.key)})}):r("p",{class:"hint",children:e.layersEmpty})}var Xt=["props","layers","agent"];function Js(){if(He.value==="motion")return r("aside",{class:"panel raised","aria-label":B.value.modeMotion,children:r(Vs,{})});if(He.value==="identity")return r("aside",{class:"panel raised","aria-label":B.value.modeIdentity,children:r(js,{})});let e=B.value,t=k(null),n={props:e.tabProps,layers:e.tabLayers,agent:e.tabAgent},i=ge.value.notes.filter(s=>s.status==="open").length,a=s=>{let o=te.value==="ar",c=s.code==="ArrowLeft"?o?1:-1:s.code==="ArrowRight"?o?-1:1:0;if(!c)return;s.preventDefault();let d=Xt[(Xt.indexOf(q.value)+c+Xt.length)%Xt.length];q.value=d,t.current?.querySelector(`[data-tab="${d}"]`)?.focus()};return r("aside",{class:"panel raised","aria-label":e.tabsLabel,children:[r("div",{class:"tabs tray",role:"tablist",ref:t,onKeyDown:a,children:Xt.map(s=>r("button",{type:"button",role:"tab",id:`tab-${s}`,"data-tab":s,"aria-selected":q.value===s,"aria-controls":`tabpanel-${s}`,tabIndex:q.value===s?0:-1,class:q.value===s?"on":"",onClick:()=>{q.value=s},children:[n[s],s==="agent"&&i>0&&r("span",{class:"tab-count","data-testid":"agent-count",children:Te(i,te.value)})]},s))}),r("div",{class:"tabpanel",role:"tabpanel",id:`tabpanel-${q.value}`,"aria-labelledby":`tab-${q.value}`,children:[q.value==="props"&&r(jo,{}),q.value==="layers"&&r(qo,{}),q.value==="agent"&&r(As,{})]})]})}var _t=(e,t,n)=>Math.min(n,Math.max(t,e));function Ai(e,t){let n=_t(Math.min(e.x,t.x),0,1920),i=_t(Math.min(e.y,t.y),0,1080),a=_t(Math.max(e.x,t.x),0,1920),s=_t(Math.max(e.y,t.y),0,1080);return a<=n||s<=i?null:{x:n,y:i,width:a-n,height:s-i}}function Zs(e){return{x:_t(e.x+e.width/2,0,1920),y:_t(e.y,0,1080)}}var ta=1920,na=1080,ia=64;function Jo(e,t,n=ia){let i=Math.min((e-2*n)/ta,(t-2*n)/na);return Math.max(.05,Math.floor(i*1e3)/1e3)}function vi(e,t){let n=de();if(!n)return null;let i=t.getBoundingClientRect(),a=j.value,s=n.hitLocal((e.clientX-i.left)/a,(e.clientY-i.top)/a);return s?L(s.key):null}var Qt=e=>e?.getAttribute("data-nm-key")??null,Zo=["nw","n","ne","e","se","s","sw","w"];function ea({k:e,kind:t,primary:n,onPointerDown:i}){Ve.value;let a=L(e);if(!a)return null;let s=De(a),o=j.value,c={left:`${s.left*o}px`,top:`${s.top*o}px`,width:`${Math.max(1,s.width*o)}px`,height:`${Math.max(1,s.height*o)}px`};return t==="hover"?r("div",{class:"ov-hover",style:c,"aria-hidden":"true","data-testid":"hover-box"}):r("div",{class:`ov-sel${n?" is-primary":""}`,style:c,"data-testid":"selection-box","data-key":e,children:[n&&r("span",{class:`ov-tag ${te.value==="ar"?"at-right":"at-left"}`,children:tt(Gt(a),B.value)}),n&&Zo.map(d=>r("i",{class:`h h-${d}`,"data-handle":d,onPointerDown:m=>{m.stopPropagation(),i?.(m,e,d)}},d))]})}function el({guides:e,distances:t,equal:n}){let i=j.value;return r("div",{class:"drag-marks","aria-hidden":"true","data-testid":"drag-marks","data-equal":n?"":void 0,children:[e.map((a,s)=>r("i",{class:`guide ${a.axis}`,style:a.axis==="x"?{left:`${a.at*i}px`,top:`${a.from*i}px`,height:`${(a.to-a.from)*i}px`}:{top:`${a.at*i}px`,left:`${a.from*i}px`,width:`${(a.to-a.from)*i}px`}},`g${s}`)),t.map((a,s)=>r("span",{class:"distance",style:{left:`${a.x*i}px`,top:`${a.y*i}px`},children:[a.value,"px"]},`d${s}`))]})}function tl(){Ve.value;let e=j.value,t=ge.value.notes.filter(n=>n.status==="open"&&n.target.slide===D.value+1);return r("div",{class:"note-marks","aria-label":B.value.openNotes,children:[t.map(n=>{let i=n.target.kind==="area"?n.target.rect:(()=>{let o=L(n.target.key);if(!o)return null;let c=De(o);return{x:c.left,y:c.top,width:c.width,height:c.height}})();if(!i)return null;let a=Zs(i),s=()=>{pe(n.target.slide-1),R.value=n.target.kind==="element"?n.target.key:null,q.value="agent"};return r("div",{children:[n.target.kind==="area"&&r("button",{type:"button",class:"note-area-mark",style:{left:`${i.x*e}px`,top:`${i.y*e}px`,width:`${i.width*e}px`,height:`${i.height*e}px`},"aria-label":n.text,"data-testid":"note-area",onClick:s}),r("button",{type:"button",class:"note-pin",style:{left:`${a.x*e}px`,top:`${a.y*e}px`},title:n.text,"aria-label":n.text,"data-testid":"note-pin","data-note-id":n.id,onClick:s,children:r("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:r("path",{d:"M5 5h14v10H9l-4 4z"})})})]},n.id)}),re.value&&r("div",{class:"note-area-draft",style:{left:`${re.value.x*e}px`,top:`${re.value.y*e}px`,width:`${re.value.width*e}px`,height:`${re.value.height*e}px`},"aria-hidden":"true"})]})}function ra(){let e=k(null),t=k(null),n=k(null),i=k(null),a=k(!1),s=k(!1),[o,c]=W(null),d=B.value,m=j.value;H(()=>{let T=e.current;if(!T)return;let f=new ResizeObserver(()=>{dt.value=Jo(T.clientWidth,T.clientHeight)});return f.observe(T),()=>f.disconnect()},[]);let u=T=>{if(!t.current||ae.value||s.current)return;if(_e.value&&i.current){let _=t.current.getBoundingClientRect();re.value=Ai(i.current,{x:(T.clientX-_.left)/j.value,y:(T.clientY-_.top)/j.value});return}let f=vi(T,t.current),E=f&&!(T.ctrlKey||T.metaKey)?Rn(f):f,b=Qt(E);ie.value=b===R.value?null:b},y=T=>{if(!t.current||ae.value)return;if(a.current){a.current=!1;return}if(_e.value)return;let f=vi(T,t.current);if(T.detail>1){let b=L(n.current);if(n.current=null,!f)return;if(b&&b!==f&&b.contains(f)){let x=ws(b,f);x&&Ee(Qt(x));return}let _=Qt(f);if(_&&(f.textContent??"").trim()&&zs(_))return;Ee(_);return}if(Ae.value){nt(!0).catch(()=>{});return}let E=f&&!(T.ctrlKey||T.metaKey)?Rn(f):f;Ee(Qt(E),T.shiftKey),ie.value=null},v=(T,f,E)=>{if(!li(T)||ae.value||Ae.value)return;T.preventDefault(),T.stopPropagation(),w.value.includes(f)||Ee(f);let b=E?[f]:w.value.includes(f)?[...w.value]:[f],_=L(f);if(!_)return;let x=De(_),C={x:x.left,y:x.top,width:x.width,height:x.height},M=Array.from(_.parentElement?.children??[]).filter(I=>I!==_&&!b.includes(I.getAttribute("data-nm-key")??"")).map(I=>De(I)).map(I=>({x:I.left,y:I.top,width:I.width,height:I.height})),Y=b.map(I=>L(I)).filter(I=>!!I),he=Y.map(I=>({el:I,translate:I.style.translate,width:I.style.width,height:I.style.height})),X=T.clientX,A=T.clientY,S=0,F=0;s.current=!0,ie.value=null;let Q=I=>{let it=(I.clientX-X)/j.value,rt=(I.clientY-A)/j.value,Ne=!E&&!(I.ctrlKey||I.metaKey)?Kr(C,it,rt,M,j.value):{dx:it,dy:rt,guides:[],distances:[],equalSpacing:!1};if(S=Ne.dx,F=Ne.dy,E){let ue=E.includes("w"),We=E.includes("n");_.style.width=`${Math.max(1,C.width+(E.includes("e")?S:ue?-S:0))}px`,_.style.height=`${Math.max(1,C.height+(E.includes("s")?F:We?-F:0))}px`,_.style.translate=`${ue?S:0}px ${We?F:0}px`}else Y.forEach(ue=>{ue.style.translate=`${S}px ${F}px`});c({guides:Ne.guides,distances:Ne.distances,equal:Ne.equalSpacing})},J=()=>{window.removeEventListener("pointermove",Q),window.removeEventListener("pointerup",J),window.removeEventListener("pointercancel",me),he.forEach(({el:I,translate:it,width:rt,height:Ne})=>{I.style.translate=it,I.style.width=rt,I.style.height=Ne}),s.current=!1,c(null),(Math.round(S)||Math.round(F))&&Cn(b,E?{kind:"resize",handle:E,dx:S,dy:F}:{kind:"move",dx:S,dy:F})},me=()=>{S=0,F=0,J()};window.addEventListener("pointermove",Q),window.addEventListener("pointerup",J,{once:!0}),window.addEventListener("pointercancel",me,{once:!0})},h=Math.round(m*100);return r("main",{class:"well pressed","aria-label":d.canvasLabel,children:[r("div",{class:"scroller",ref:e,children:r("div",{class:"stage-pad",style:{padding:`${ia}px`},children:r("div",{class:"stage",ref:t,dir:"ltr",style:{width:`${ta*m}px`,height:`${na*m}px`},children:[r("div",{class:"clip",children:r("iframe",{id:"frame",name:"nm-preview",ref:gr,title:d.previewTitle,tabIndex:-1,style:{transform:`scale(${m})`}})}),r("div",{class:`hit${ae.value?" is-playing":""}${Ae.value?" is-editing":""}${_e.value?" is-targeting":""}`,onPointerDown:T=>{if(!t.current||_e.value)return;let f=vi(T,t.current),E=f&&!(T.ctrlKey||T.metaKey)?Rn(f):f,b=Qt(E);if(b&&w.value.includes(b)){v(T,b);return}let _=f?w.value.find(Y=>L(Y)?.contains(f)):void 0;if(!_||!li(T))return;let x=T,C=Y=>{Math.hypot(Y.clientX-x.clientX,Y.clientY-x.clientY)<3||(M(),v(x,_))},M=()=>{window.removeEventListener("pointermove",C),window.removeEventListener("pointerup",M)};window.addEventListener("pointermove",C),window.addEventListener("pointerup",M)},onMouseDown:T=>{if(_e.value&&t.current){let f=t.current.getBoundingClientRect();i.current={x:(T.clientX-f.left)/j.value,y:(T.clientY-f.top)/j.value},re.value=null,T.preventDefault();return}T.detail===1&&(n.current=R.value)},onMouseMove:u,onMouseUp:T=>{if(!i.current||!t.current)return;let f=t.current.getBoundingClientRect();re.value=Ai(i.current,{x:(T.clientX-f.left)/j.value,y:(T.clientY-f.top)/j.value}),i.current=null,re.value&&(_e.value=!1),a.current=!0},onMouseLeave:()=>{ie.value=null},onClick:y,"data-testid":"hit-layer"}),!ae.value&&!Ae.value&&r("div",{class:"overlays",children:[ie.value&&r(ea,{k:ie.value,kind:"hover"}),w.value.map(T=>r(ea,{k:T,kind:"selection",primary:T===R.value,onPointerDown:v},T)),o&&r(el,{guides:o.guides,distances:o.distances,equal:o.equal})]}),!ae.value&&r(tl,{})]})})}),r("output",{class:"zoomw","aria-label":d.zoomLabel,"data-testid":"zoom-readout",children:[r("span",{class:"read",children:[Te(h,te.value),te.value==="ar"?"\\u066A":"%"]}),Fe.value==="fit"&&r("span",{children:d.zoomFit})]})]})}function sa(e,t){if(!t||e.altKey)return null;let n=e.ctrlKey||e.metaKey;if(n&&e.code==="KeyD")return{kind:"duplicate"};if(n&&(e.code==="BracketRight"||e.code==="BracketLeft"))return{kind:"z",delta:e.code==="BracketRight"?1:-1,extreme:e.shiftKey};if(!n&&(e.code==="Delete"||e.code==="Backspace"))return{kind:"delete"};if(!n&&/^Arrow(?:Left|Right|Up|Down)$/.test(e.code)){let i=e.shiftKey?10:1;return{kind:"nudge",dx:e.code==="ArrowLeft"?-i:e.code==="ArrowRight"?i:0,dy:e.code==="ArrowUp"?-i:e.code==="ArrowDown"?i:0}}return null}var{currentSlide:Pn,fihrisCompact:Si,info:yi,lang:oa,playing:nl,selection:la,slideTitle:il,t:rl,version:Ci,zoom:sl}=dn;oa.value=new URLSearchParams(location.search).get("lang")==="en"?"en":"ar";xe(()=>{let e=oa.value;document.documentElement.lang=e,document.documentElement.dir=e==="ar"?"rtl":"ltr"});xe(()=>{let e=il(0);document.title=e?rl.value.documentTitle(e):"Nevermind Studio"});xe(()=>{if(!yi.value)return;let e=Pn.value+1,t=la.value??void 0;P.current(e,t).catch(()=>{})});var al=[["Thmanyah Sans","thmanyahsans-Regular.otf","400"],["Thmanyah Sans","thmanyahsans-Medium.otf","500"],["Thmanyah Sans","thmanyahsans-Bold.otf","700"],["Thmanyah Serif Display","thmanyahserifdisplay-Bold.otf","700"],["Thmanyah Serif Display","thmanyahserifdisplay-Black.otf","900"],["Zain Rounded","ZainRounded-VF.ttf","200 900"]],aa=!1;for(let[e,t,n]of al){let i=new FontFace(e,`url("${pr(t)}")`,{weight:n,display:"swap"});document.fonts.add(i),i.load().catch(()=>{aa||(aa=!0,console.warn("nm-studio: editor fonts unavailable; using the system fonts"))})}function ol(){if(nl.value){Nn();return}let e=L(la.value);if(!e){Ee(null);return}let t=et(e);Ee(t&&!t.classList.contains("slide")?t.getAttribute("data-nm-key"):null)}window.addEventListener("keydown",e=>{let t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))||ve.value||t?.closest?.("dialog[open]"))return;let n=e.ctrlKey||e.metaKey,i=sa(e,w.value.length>0);if(i){e.preventDefault(),i.kind==="nudge"?Cn(w.value,{kind:"move",dx:i.dx,dy:i.dy},`nudge:${w.value.join(",")}`):i.kind==="duplicate"?ns():i.kind==="delete"?is():rs(i.delta,i.extreme);return}if(n&&e.code==="KeyZ"){e.preventDefault(),(e.shiftKey?vn:An)();return}if(n&&e.code==="KeyS"){e.preventDefault(),mt();return}if(n&&(e.code==="Equal"||e.code==="NumpadAdd")){e.preventDefault(),pi(1);return}if(n&&(e.code==="Minus"||e.code==="NumpadSubtract")){e.preventDefault(),pi(-1);return}if(n&&(e.code==="Digit0"||e.code==="Numpad0")){e.preventDefault(),ps();return}if(!(n||e.altKey)){if(e.code==="PageDown"){e.preventDefault(),pe(Pn.value+1);return}if(e.code==="PageUp"){e.preventDefault(),pe(Pn.value-1);return}e.code==="Escape"&&ol()}});window.addEventListener("pointerdown",e=>{!Ae.value||e.target?.closest?.(".hit, #frame, dialog")||nt(!0).catch(()=>{})},!0);function ll(){return r("div",{class:`app${Si.value?" fihris-compact":""}`,children:[r(bs,{}),r(hs,{}),r(ra,{}),r(Js,{}),r(gs,{}),r(ms,{}),r(_s,{})]})}var ca=window.matchMedia("(max-height: 820px)");Si.value=ca.matches;ca.addEventListener("change",e=>{Si.value=e.matches});Ui(r(ll,{}),document.getElementById("app"));var cl=ze(async()=>{let[e]=await Promise.all([hn(),ye()]);Ci.value=e});Sr();window.nmShell={clientId:ut,events:ei,thumbStats:Et,ready:cl,signals:dn,get state(){return yi.value?{info:yi.value,version:Ci.value,...ne.value,lint:Oe.value,conflict:ce.value}:null},get version(){return Ci.value},get current(){return Pn.value},get zoom(){return sl.value},goTo:pe,select:Ee,setLang:Sn,postOps:K,settled:es,api:(e,t)=>t===void 0?fetch(`${e}${e.includes("?")?"&":"?"}t=${encodeURIComponent(new URLSearchParams(location.search).get("t")??"")}`).then(n=>n.json()):fetch(e,{method:"POST",headers:{"X-NM-Token":new URLSearchParams(location.search).get("t")??"","Content-Type":"application/json"},body:JSON.stringify(t)}).then(n=>n.json()),apply:Dt,reload:Zn,refresh:ye,serverState:P.state};})();\n</script>\n</body>\n</html>\n';
var shellHtml = () => Promise.resolve(SHELL);

// src/server/fonts.ts
import { existsSync as existsSync2, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join as join2 } from "node:path";
var UI_FONT_FILES = /* @__PURE__ */ new Set([
  "thmanyahsans-Regular.otf",
  "thmanyahsans-Medium.otf",
  "thmanyahsans-Bold.otf",
  "thmanyahserifdisplay-Bold.otf",
  "thmanyahserifdisplay-Black.otf",
  "ZainRounded-VF.ttf"
]);
var warned = false;
function uiFontsDir() {
  const dir = process.env.NM_STUDIO_FONTS || join2(homedir(), ".claude", "skills", "nevermind-slides", "resources", "fonts");
  if (existsSync2(dir)) return realpathSync(dir);
  if (!warned) {
    warned = true;
    process.stderr.write(`nm-studio: editor fonts not found at ${dir}; the interface uses the system fonts
`);
  }
  return null;
}

// src/server/layout-presets.ts
import { readFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join3 } from "node:path";
var CATALOG = [
  ["opening/offset-marquee", "Offset Marquee"],
  ["opening/monolith", "Monolith"],
  ["opening/split-ledger", "Split Ledger"],
  ["opening/half-plate", "Half Plate"],
  ["section/chapter-gate", "Chapter Gate"],
  ["section/waypoint", "Waypoint"],
  ["section/index-ledger", "Index Ledger"],
  ["list/ledger-list", "Ledger List"],
  ["list/counter-cards", "Counter Cards"],
  ["list/staircase", "Staircase"],
  ["stats/keynote-figure", "Keynote Figure"],
  ["stats/stat-strip", "Stat Strip"],
  ["stats/ratio-split", "Ratio Split"],
  ["chart/skyline", "Skyline"],
  ["chart/aperture", "Aperture"],
  ["chart/crossover", "Crossover"],
  ["quote/testimony", "Testimony"],
  ["comparison/ledger-versus", "Ledger Versus"],
  ["comparison/fulcrum", "Fulcrum"],
  ["image/plate-caption", "Plate Caption"],
  ["image/triptych", "Triptych"],
  ["timeline/meridian", "Meridian"],
  ["closing/terminal-frame", "Terminal Frame"]
].map(([id, name]) => ({ id, slot: id.split("/")[0], name }));
var LayoutPresetError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "LayoutPresetError";
    this.code = code;
  }
};
var defaultLayoutPresetsRoot = () => process.env.NM_LAYOUT_PRESETS_DIR || join3(homedir2(), ".claude", "skills", "nevermind-slides", "resources", "engine", "frontend-slides", "layout-presets");
function listLayoutPresets() {
  return CATALOG.map((preset) => ({ ...preset }));
}
function readLayoutPreset(id, root = defaultLayoutPresetsRoot()) {
  const preset = CATALOG.find((candidate) => candidate.id === id);
  if (!preset) throw new LayoutPresetError("unknown-preset", `unknown layout preset ${JSON.stringify(id)}`);
  let text;
  try {
    text = readFileSync(join3(root, ...preset.id.split("/"), "preview.html"), "utf8");
  } catch {
    throw new LayoutPresetError("missing-presets", `layout preset resources are not installed at ${root}`);
  }
  const doc = parseSource(text);
  const slide = doc.nodes.find((node) => node.tag === "section" && classList(node).includes("slide") && node.patchable);
  if (!slide) throw new LayoutPresetError("invalid-preset", `layout preset ${id} has no source-backed slide section`);
  const local = parseSource(text.slice(slide.start, slide.end));
  const localSlide = local.nodes.find((node) => node.tag === "section" && classList(node).includes("slide") && node.patchable);
  if (!localSlide) throw new LayoutPresetError("invalid-preset", `layout preset ${id} slide cannot be extracted`);
  const classes = classList(localSlide).filter((name) => name !== "active" && name !== "visible");
  const html = applySplices(local.text, setAttrSplices(local, localSlide, "class", classes.join(" ")));
  return { ...preset, html };
}

// src/server/notes.ts
import { randomUUID } from "node:crypto";
import { existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir2, readFile as readFile2, rename as rename2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname2, join as join4 } from "node:path";
var emptyNotes = () => ({ version: 1, notes: [] });
var MAX_NOTES_BYTES = 2 * 1024 * 1024;
var serialize2 = (value) => `${JSON.stringify(value, null, 2)}
`;
var NotesError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "NotesError";
    this.code = code;
  }
};
function validSlide(slide) {
  return Number.isInteger(slide) && slide >= 1;
}
function validateCreate(input) {
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (text.length < 1 || text.length > 4e3) throw new NotesError("bad-note-text", "note text must be 1 to 4000 characters after trimming");
  const target = input?.target;
  if (!target || !validSlide(target.slide)) throw new NotesError("bad-note-target", "note target requires a positive slide number");
  if (target.kind === "area") {
    const { x, y, width, height } = target.rect ?? {};
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1920 || y + height > 1080) {
      throw new NotesError("bad-note-target", "area rectangle must be finite, positive and within the 1920 by 1080 stage");
    }
  } else if (target.kind === "element") {
    if (typeof target.key !== "string" || !target.key || typeof target.tag !== "string" || !target.tag || typeof target.role !== "string" || !target.role || !Array.isArray(target.classes) || !target.classes.every((x) => typeof x === "string")) {
      throw new NotesError("bad-note-target", "element target requires key, tag, role and string classes");
    }
  } else {
    throw new NotesError("bad-note-target", "note target kind must be element or area");
  }
  return { text, target: structuredClone(target) };
}
function parseNotes(text) {
  if (Buffer.byteLength(text) > MAX_NOTES_BYTES) throw new NotesError("notes-too-large", `malformed notes metadata: file exceeds ${MAX_NOTES_BYTES} bytes`);
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new NotesError("malformed-notes", `malformed notes metadata: ${error.message}`);
  }
  const doc = value;
  if (!doc || doc.version !== 1 || !Array.isArray(doc.notes)) throw new NotesError("malformed-notes", "malformed notes metadata: expected version 1 and a notes array");
  const ids = /* @__PURE__ */ new Set();
  for (const raw of doc.notes) {
    const note = raw;
    if (typeof note.id !== "string" || !/^note_[a-z0-9-]+$/.test(note.id) || ids.has(note.id)) throw new NotesError("malformed-notes", "malformed notes metadata: invalid or duplicate note id");
    ids.add(note.id);
    const valid = validateCreate({ text: note.text, target: note.target });
    if (valid.text !== note.text || note.status !== "open" && note.status !== "done" || typeof note.createdAt !== "string" || !Number.isFinite(Date.parse(note.createdAt))) {
      throw new NotesError("malformed-notes", `malformed notes metadata: invalid note ${note.id}`);
    }
    if (note.status === "done" && (typeof note.completedAt !== "string" || !Number.isFinite(Date.parse(note.completedAt)))) {
      throw new NotesError("malformed-notes", `malformed notes metadata: completed note ${note.id} requires completedAt`);
    }
  }
  return structuredClone(doc);
}
async function writeAtomic(path, value) {
  const dir = dirname2(path);
  await mkdir2(dir, { recursive: true });
  const temp = join4(dir, `.notes-${process.pid}-${randomUUID()}.tmp`);
  const text = serialize2(value);
  await writeFile2(temp, text, { encoding: "utf8", flag: "wx" });
  await rename2(temp, path);
  return text;
}
var NotesStore = class _NotesStore {
  deckPath;
  notesPath;
  currentPath;
  document;
  notesText;
  listeners = /* @__PURE__ */ new Set();
  timer;
  checking = false;
  closed = false;
  constructor(deckPath, document, notesText) {
    this.deckPath = deckPath;
    this.notesPath = join4(dirname2(deckPath), ".nevermind", "notes.json");
    this.currentPath = join4(dirname2(deckPath), ".nevermind", "current.json");
    this.document = document;
    this.notesText = notesText;
    this.timer = setInterval(() => {
      this.checkExternal().catch(() => {
      });
    }, 100);
    this.timer.unref();
  }
  static async open(deckPath) {
    const notesPath = join4(dirname2(deckPath), ".nevermind", "notes.json");
    if (!existsSync3(notesPath)) return new _NotesStore(deckPath, emptyNotes(), null);
    const text = await readFile2(notesPath, "utf8");
    const parsed = parseNotes(text);
    return new _NotesStore(deckPath, parsed, text);
  }
  read() {
    return structuredClone(this.document);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify(source) {
    const document = this.read();
    for (const listener of this.listeners) listener(document, source);
  }
  async checkExternal() {
    if (this.closed || this.checking) return;
    this.checking = true;
    try {
      let text;
      try {
        text = await readFile2(this.notesPath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        text = null;
      }
      if (text === this.notesText) return;
      const document = text === null ? emptyNotes() : parseNotes(text);
      this.notesText = text;
      this.document = document;
      this.notify("external");
    } finally {
      this.checking = false;
    }
  }
  async create(input) {
    const valid = validateCreate(input);
    const note = {
      id: `note_${randomUUID()}`,
      text: valid.text,
      status: "open",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: valid.target
    };
    const next = { version: 1, notes: [...this.document.notes, note] };
    this.notesText = await writeAtomic(this.notesPath, next);
    this.document = next;
    this.notify("editor");
    return structuredClone(note);
  }
  async done(id) {
    const index = this.document.notes.findIndex((note) => note.id === id);
    if (index < 0) throw new NotesError("unknown-note", `unknown note id: ${id}`);
    const existing = this.document.notes[index];
    if (existing.status === "done") return structuredClone(existing);
    const completed = { ...existing, status: "done", completedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const notes2 = [...this.document.notes];
    notes2[index] = completed;
    const next = { version: 1, notes: notes2 };
    this.notesText = await writeAtomic(this.notesPath, next);
    this.document = next;
    this.notify("editor");
    return structuredClone(completed);
  }
  async writeCurrent(input) {
    if (typeof input.fingerprint !== "string" || !input.fingerprint || !validSlide(input.slide)) {
      throw new NotesError("bad-current", "current context requires a fingerprint and positive slide number");
    }
    if (input.selection) validateCreate({ text: "context", target: input.selection });
    const current2 = {
      version: 1,
      deck: this.deckPath,
      fingerprint: input.fingerprint,
      slide: input.slide,
      selection: input.selection ? structuredClone(input.selection) : null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeAtomic(this.currentPath, current2);
    return structuredClone(current2);
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.listeners.clear();
  }
};

// src/server/open.ts
import { spawn } from "node:child_process";
function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", '""', url.replace(/&/g, "^&")] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}

// src/server/preview.ts
function bodyOf(doc) {
  return doc.nodes.find((n) => n.tag === "body" && n.start >= 0) ?? doc.nodes.find((n) => n.tag === "body");
}
function inBody(doc, n, bodyId) {
  if (bodyId === void 0) return false;
  for (let p = n.id; p !== null; p = doc.nodes[p].parent) if (p === bodyId) return true;
  return false;
}
function keySplices(doc, refs, from, to) {
  const bodyId = bodyOf(doc)?.id;
  const out2 = [];
  for (const n of doc.nodes) {
    if (!n.patchable || n.start < from || n.start >= to || !inBody(doc, n, bodyId)) continue;
    const at2 = n.start + 1 + n.tag.length;
    out2.push({ start: at2, end: at2, text: ` data-nm-key="${refs.keyOf(n.id)}"` });
  }
  return out2;
}
function headInsertion(doc) {
  const head = doc.nodes.find((n) => n.tag === "head" && n.start >= 0);
  if (head) return head.startTagEnd;
  const html = doc.nodes.find((n) => n.tag === "html" && n.start >= 0);
  if (html) return html.startTagEnd;
  const m = /^﻿?\s*<!doctype[^>]*>/i.exec(doc.text);
  return m ? m[0].length : doc.bom ? 1 : 0;
}
function buildPreview(doc, refs, layer, version2) {
  const at2 = headInsertion(doc);
  const body = bodyOf(doc);
  const firstBodyChild = body && body.children.length ? doc.byId(body.children[0]).start : Infinity;
  if (firstBodyChild >= 0 && at2 > firstBodyChild) throw new Error("head insertion point is after body content");
  const js = layer.js.replace(/<\/script/gi, "<\\/script");
  const css = layer.css.replace(/<\/style/gi, "<\\/style");
  const inject = `<style id="nm-edit-mode-css">${css}</style><script id="nm-edit-mode-js">${js}</script><meta name="nm-runtime" content="1" data-nm-injected><meta name="nm-version" content="${version2}"><base href="/deck/">`;
  const splices = keySplices(doc, refs, 0, Infinity);
  splices.push({ start: at2, end: at2, text: inject });
  return applySplices(doc.text, splices);
}
function outerHtml(doc, refs, id) {
  const n = doc.byId(id);
  const splices = keySplices(doc, refs, n.start, n.end).map((s) => ({ ...s, start: s.start - n.start, end: s.end - n.start }));
  return applySplices(doc.text.slice(n.start, n.end), splices);
}
var RELOAD_IF_INSIDE = /* @__PURE__ */ new Set(["iframe", "script", "video", "audio", "object", "embed"]);
function subtreeHas(doc, id, tags) {
  const stack = [id];
  while (stack.length) {
    const n = doc.nodes[stack.pop()];
    if (tags.has(n.tag)) return true;
    stack.push(...n.children);
  }
  return false;
}
function hasAncestorIn(doc, id, set) {
  for (let p = doc.nodes[id].parent; p !== null; p = doc.nodes[p].parent) if (set.has(p)) return true;
  return false;
}
function previewPatch(doc, refs, diff, structuralTextKeys = []) {
  if (diff.structural && structuralTextKeys.length === 0) return "reload";
  const bodyId = bodyOf(doc)?.id;
  const items = [];
  const changes = diff.structural ? [[structuralTextKeys, false]] : [[diff.content, false], [diff.attrs, true]];
  for (const [keys, attrsOnly] of changes) {
    for (const key of keys) {
      const id = refs.idOf(key);
      if (id === null) return "reload";
      const n = doc.nodes[id];
      if (!n.patchable || n.tag === "html" || n.tag === "head" || !inBody(doc, n, bodyId)) return "reload";
      if (!attrsOnly) {
        if (n.tag === "body" || classList(n).includes("slide") || subtreeHas(doc, id, RELOAD_IF_INSIDE)) return "reload";
      }
      items.push({ id, key, attrsOnly });
    }
  }
  if (items.length === 0) return "reload";
  const unique = [...new Map(items.map((i2) => [i2.key, i2])).values()];
  const replaced = new Set(unique.filter((i2) => !i2.attrsOnly).map((i2) => i2.id));
  return unique.filter((i2) => !hasAncestorIn(doc, i2.id, replaced)).sort((a, b) => a.id - b.id).map((i2) => ({ key: i2.key, outerHTML: outerHtml(doc, refs, i2.id), attrsOnly: i2.attrsOnly }));
}

// src/server/security.ts
import { timingSafeEqual } from "node:crypto";
import { realpath } from "node:fs/promises";
import { join as join5, resolve as resolve2, sep } from "node:path";
var deny = (status, error, message) => ({ ok: false, status, error, message });
var allowedHosts = (port) => [`127.0.0.1:${port}`, `localhost:${port}`];
var allowedOrigins = (port) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
var header = (req, name) => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};
function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function checkRequest(req, g) {
  const host = header(req, "host");
  if (!host || !allowedHosts(g.port).includes(host.toLowerCase())) {
    return deny(403, "bad-host", "Host must be 127.0.0.1 or localhost with the server port (DNS rebinding guard)");
  }
  const site = header(req, "sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return deny(403, "cross-site", `request comes from ${site} context`);
  }
  const origin = header(req, "origin");
  const readOnly = req.method === "GET" || req.method === "HEAD";
  if (origin !== void 0) {
    if (!allowedOrigins(g.port).includes(origin)) return deny(403, "bad-origin", "Origin is not this server");
  } else if (!readOnly) {
    return deny(403, "missing-origin", "state-changing requests must carry an Origin header equal to the server origin");
  }
  return { ok: true };
}
var cookieName = (port) => `nm_t_${port}`;
function cookieValue(req, name) {
  const raw = header(req, "cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i2 = part.indexOf("=");
    if (i2 > 0 && part.slice(0, i2).trim() === name) return part.slice(i2 + 1).trim();
  }
  return null;
}
function checkToken(req, url, g, allowCookie) {
  const supplied = url.searchParams.get("t") ?? header(req, "x-nm-token") ?? (allowCookie ? cookieValue(req, cookieName(g.port)) : null);
  if (!supplied) return deny(401, "no-token", "session token required (?t=\u2026 or X-NM-Token)");
  if (!safeEqual(supplied, g.token)) return deny(401, "bad-token", "session token is wrong");
  return { ok: true };
}
async function resolveUnder(root, rawRel) {
  let rel;
  try {
    rel = decodeURIComponent(rawRel);
  } catch {
    return null;
  }
  if (rel.includes("\0") || rel.includes("\\")) return null;
  if (rel.split("/").some((seg) => seg.startsWith("."))) return null;
  const p = resolve2(join5(root, rel));
  if (p !== root && !p.startsWith(root + sep)) return null;
  try {
    const real = await realpath(p);
    if (real !== root && !real.startsWith(root + sep)) return null;
    return real;
  } catch {
    return p;
  }
}

// src/server/session.ts
import { dirname as dirname3 } from "node:path";

// src/server/changed-lines.ts
var LCS_CELL_LIMIT = 4e6;
function middleCount(a, b) {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Math.max(n, m);
  if (n * m > LCS_CELL_LIMIT) return Math.max(n, m);
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i3 = n - 1; i3 >= 0; i3--) for (let j2 = m - 1; j2 >= 0; j2--) dp[i3][j2] = a[i3] === b[j2] ? dp[i3 + 1][j2 + 1] + 1 : Math.max(dp[i3 + 1][j2], dp[i3][j2 + 1]);
  let total = 0;
  let del = 0;
  let ins = 0;
  const flush = () => {
    total += Math.max(del, ins);
    del = 0;
    ins = 0;
  };
  let i2 = 0;
  let j = 0;
  while (i2 < n && j < m) {
    if (a[i2] === b[j]) {
      flush();
      i2++;
      j++;
    } else if (dp[i2 + 1][j] >= dp[i2][j + 1]) {
      del++;
      i2++;
    } else {
      ins++;
      j++;
    }
  }
  del += n - i2;
  ins += m - j;
  flush();
  return total;
}
function changedLines(before, after) {
  if (before === after) return 0;
  const a = before.split("\n");
  const b = after.split("\n");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  return middleCount(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf));
}
function changedLinesCache() {
  let lastA = null;
  let lastB = null;
  let last = 0;
  return (a, b) => {
    if (a !== lastA || b !== lastB) {
      last = changedLines(a, b);
      lastA = a;
      lastB = b;
    }
    return last;
  };
}

// src/server/session.ts
var HttpError = class extends Error {
  status;
  code;
  extra;
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
};
var LINT_DELAY_MS = 250;
var Session = class _Session {
  deckPath;
  file;
  doc;
  baseRefs;
  version = 1;
  conflict = null;
  done = [];
  undone = [];
  marker = null;
  // top of the log when we last saved or loaded
  listeners = /* @__PURE__ */ new Set();
  chain = Promise.resolve();
  lintTimer = null;
  lastLint = "";
  closed = false;
  countLines = changedLinesCache();
  constructor(deckPath, file) {
    this.deckPath = deckPath;
    this.file = file;
    this.doc = EditorDocument.fromText(file.text);
    this.baseRefs = this.doc.refs;
  }
  static async open(deckPath) {
    const s = new _Session(deckPath, await loadDeck(deckPath));
    s.lastLint = JSON.stringify(s.lint());
    return s;
  }
  close() {
    this.closed = true;
    if (this.lintTimer) clearTimeout(this.lintTimer);
    this.listeners.clear();
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit(e) {
    for (const fn of this.listeners) fn(e);
  }
  /** Serialise everything that touches the file or replaces the document. */
  exclusive(fn) {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => {
    });
    return run;
  }
  // --- reads ----------------------------------------------------------------------------------------------------
  get currentVersion() {
    return this.version;
  }
  get text() {
    return this.doc.text;
  }
  get isDirty() {
    return this.doc.text !== this.file.text;
  }
  get changedLines() {
    return this.countLines(this.file.text, this.doc.text);
  }
  /** The editor's current text (unsaved edits included) and its version: what an export is made from. */
  exportSource() {
    return { text: this.doc.text, version: this.version };
  }
  /** The current document for rendering a preview. */
  snapshot() {
    return { doc: this.doc.doc, refs: this.doc.refs, version: this.version };
  }
  info() {
    const doc = this.doc.doc;
    const refs = this.doc.refs;
    const info = inspectDeck(doc);
    const key = (id) => refs.keyOf(id);
    const morph = {};
    for (const [name, ids] of Object.entries(info.morph)) morph[name] = ids.map(key);
    return {
      ...info,
      slides: info.slides.map((s) => ({ ...s, key: key(s.id) })),
      zoomSteps: info.zoomSteps.map((z) => ({ ...z, key: key(z.id), slideKey: z.slideId >= 0 ? key(z.slideId) : null })),
      entrances: info.entrances.map((item) => ({ ...item, key: key(item.id), slideKey: item.slideId >= 0 ? key(item.slideId) : null })),
      anatomy: info.anatomy.map((item) => ({ ...item, key: key(item.id), slideKey: item.slideId >= 0 ? key(item.slideId) : null })),
      morph
    };
  }
  lint() {
    const doc = this.doc.doc;
    const refs = this.doc.refs;
    return lintDeck(doc, inspectDeck(doc), dirname3(this.deckPath)).map((i2) => ({
      ...i2,
      nodeKey: i2.nodeId !== null && i2.nodeId >= 0 && i2.nodeId < doc.nodes.length ? refs.keyOf(i2.nodeId) : null
    }));
  }
  state() {
    return {
      version: this.version,
      fingerprint: this.file.fingerprint,
      dirty: this.isDirty,
      changedLines: this.changedLines,
      canUndo: this.doc.canUndo(),
      canRedo: this.doc.canRedo(),
      conflict: this.conflict,
      info: this.info(),
      lint: this.lint()
    };
  }
  outline(slide, depth) {
    const doc = this.doc.doc;
    const slides = inspectDeck(doc).slides;
    const s = slides[slide - 1];
    if (!s) throw new HttpError(400, "bad-slide", `slide ${slide}: the deck has ${slides.length} slides (numbered from 1)`);
    const refs = this.doc.refs;
    return { version: this.version, slide, outline: outline(doc, s.id, depth, (id) => refs.keyOf(id)) };
  }
  /** Resolve a transient client key to immutable, server-owned context for a durable agent note. */
  noteTarget(key) {
    const doc = this.doc.doc;
    const id = this.doc.refs.idOf(key);
    if (id === null) throw new HttpError(409, "stale-ref", `node reference ${JSON.stringify(key)} does not resolve`, { key });
    const node = doc.nodes[id];
    const info = inspectDeck(doc);
    const slideIndex = info.slides.findIndex((slide2) => {
      for (let p = id; p !== null; p = doc.nodes[p].parent) if (p === slide2.id) return true;
      return false;
    });
    if (slideIndex < 0) throw new HttpError(400, "bad-note-target", "element notes must target an element inside a slide");
    const slide = info.slides[slideIndex];
    let text = "";
    try {
      text = visibleText(doc, id).replace(/\s+/g, " ").trim().slice(0, 500);
    } catch {
    }
    const firstHeading = doc.nodes.find((candidate) => {
      if (!/^h[12]$/.test(candidate.tag)) return false;
      for (let p = candidate.id; p !== null; p = doc.nodes[p].parent) if (p === slide.id) return true;
      return false;
    });
    const childTags = node.children.map((child) => doc.nodes[child].tag);
    const inline = /* @__PURE__ */ new Set(["span", "b", "strong", "i", "em", "small", "sup", "sub", "a", "mark", "u", "br", "bdi", "bdo", "code", "abbr", "time", "s", "q"]);
    const role = node.id === slide.id ? "\u0634\u0631\u064A\u062D\u0629" : /^h[12]$/.test(node.tag) ? firstHeading?.id === node.id ? "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0631\u0626\u064A\u0633" : "\u0639\u0646\u0648\u0627\u0646" : /^h[3-6]$/.test(node.tag) ? "\u0639\u0646\u0648\u0627\u0646" : ["img", "picture", "video", "canvas"].includes(node.tag) ? "\u0635\u0648\u0631\u0629" : ["iframe", "object", "embed"].includes(node.tag) ? "\u0645\u062C\u0633\u0651\u0645" : node.tag === "svg" ? childTags.includes("image") ? "\u0635\u0648\u0631\u0629" : "\u0634\u0643\u0644" : childTags.length ? text && childTags.every((tag) => inline.has(tag)) ? "\u0646\u0635" : "\u0645\u062C\u0645\u0648\u0639\u0629" : text ? "\u0646\u0635" : "\u0634\u0643\u0644";
    return {
      kind: "element",
      key,
      ...findAttr(node, "data-nid")?.value ? { dataNid: findAttr(node, "data-nid").value } : {},
      slide: slideIndex + 1,
      ...slide.title ? { slideTitle: slide.title } : {},
      tag: node.tag,
      role,
      ...text ? { text } : {},
      classes: classList(node)
    };
  }
  /** Capture the selected source element and the immutable session version an AI proposal is based on. */
  agentSelection(key) {
    const target = this.noteTarget(key);
    const id = this.doc.refs.idOf(key);
    if (id === null) throw new HttpError(409, "stale-ref", `node reference ${JSON.stringify(key)} does not resolve`, { key });
    const node = this.doc.doc.nodes[id];
    if (!node.patchable || node.start < 0 || node.end < node.start) {
      throw new HttpError(422, "unpatchable-selection", "the selected element has no editable source range");
    }
    return {
      baseVersion: this.version,
      deckPath: this.deckPath,
      source: this.doc.text,
      key,
      id,
      slide: target.slide,
      tag: node.tag,
      role: target.role,
      ...target.text ? { text: target.text } : {},
      classes: classList(node),
      html: this.doc.text.slice(node.start, node.end),
      ...findAttr(node, "src")?.value ? { src: findAttr(node, "src").value } : {}
    };
  }
  // --- edits ----------------------------------------------------------------------------------------------------
  flags() {
    return { dirty: this.isDirty, changedLines: this.changedLines, canUndo: this.doc.canUndo(), canRedo: this.doc.canRedo() };
  }
  scheduleLint() {
    if (this.lintTimer || this.closed) return;
    this.lintTimer = setTimeout(() => {
      this.lintTimer = null;
      if (this.closed) return;
      try {
        const issues = this.lint();
        const json = JSON.stringify(issues);
        if (json === this.lastLint) return;
        this.lastLint = json;
        this.emit({ event: "lint", data: { version: this.version, issues } });
      } catch {
      }
    }, LINT_DELAY_MS);
    this.lintTimer.unref();
  }
  /** Turn the difference between two reference maps into the response and the broadcast. */
  publish(before, source, stale, origin, structuralTextKeys = []) {
    this.version++;
    const after = this.doc.refs;
    const diff = RefMap.diff(before, after);
    const patch = source === "reload" || source === "resolve" ? "reload" : previewPatch(this.doc.doc, after, diff, structuralTextKeys);
    const base = {
      version: this.version,
      changed: [...diff.created, ...diff.content, ...diff.attrs],
      removed: diff.removed,
      created: diff.created,
      previewPatch: patch,
      ...this.flags()
    };
    this.emit({ event: "version", data: { ...base, source, ...origin ? { origin } : {} } });
    this.scheduleLint();
    return { ...base, previewPatch: stale ? "reload" : patch, stale };
  }
  applyOps(req) {
    const stale = req.baseVersion !== this.version;
    const before = this.doc.refs;
    const textBefore = this.doc.text;
    const top = this.done[this.done.length - 1];
    const coalesceKey = top && top === this.marker ? void 0 : req.coalesceKey;
    let tx;
    try {
      tx = this.doc.applyKeyed(req.ops, { label: req.label, coalesceKey });
    } catch (e) {
      if (e instanceof StaleRefError) throw new HttpError(409, "stale-ref", e.message, { key: e.key });
      if (e instanceof OpError) throw new HttpError(422, "op-error", e.message, { opCode: e.code });
      throw e;
    }
    if (this.doc.text === textBefore) {
      return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale, ...this.flags() };
    }
    const minted = this.doc.mintedBy(tx);
    if (top && top.tx === tx) {
      top.ops.push(...req.ops);
      top.minted = minted;
    } else {
      this.done.push({ tx, ops: [...req.ops], label: tx.label, minted });
      this.undone = [];
    }
    const structuralTextKeys = req.ops.length > 0 && req.ops.every((op) => op.kind === "setText") ? req.ops.map((op) => op.id) : [];
    return this.publish(before, "ops", stale, req.clientId, structuralTextKeys);
  }
  /** Apply a reviewed AI proposal as one transaction, only against the exact version it inspected. */
  acceptAgentOps(req) {
    if (req.baseVersion !== this.version) {
      throw new HttpError(409, "stale-proposal", `proposal version ${req.baseVersion} does not match current version ${this.version}`, {
        proposalVersion: req.baseVersion,
        currentVersion: this.version
      });
    }
    return this.applyOps({ ...req, coalesceKey: void 0 });
  }
  undo() {
    const before = this.doc.refs;
    if (!this.doc.undo()) return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale: false, ...this.flags() };
    const e = this.done.pop();
    if (e) this.undone.push(e);
    return this.publish(before, "undo", false);
  }
  redo() {
    const before = this.doc.refs;
    if (!this.doc.redo()) return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale: false, ...this.flags() };
    const e = this.undone.pop();
    if (e) this.done.push(e);
    return this.publish(before, "redo", false);
  }
  // --- saving ---------------------------------------------------------------------------------------------------
  save() {
    return this.exclusive(async () => {
      if (this.conflict) {
        throw new HttpError(409, "conflict", "the file changed on disk while there are unsaved edits; resolve first (reload or reapply)", {
          diskFingerprint: this.conflict.diskFingerprint
        });
      }
      const text = this.doc.text;
      const refs = this.doc.refs;
      const top = this.done[this.done.length - 1] ?? null;
      let saved;
      try {
        saved = await saveDeck(this.file, text);
      } catch (e) {
        if (e instanceof ConflictError) {
          this.conflict = { diskFingerprint: e.diskFingerprint };
          this.emit({ event: "disk-changed", data: { reloaded: false, conflict: true, diskFingerprint: e.diskFingerprint, version: this.version } });
          throw new HttpError(409, "conflict", e.message, { diskFingerprint: e.diskFingerprint });
        }
        throw e;
      }
      this.file = saved;
      this.baseRefs = refs;
      this.marker = top;
      const out2 = { fingerprint: saved.fingerprint, dirty: this.isDirty, changedLines: this.changedLines, version: this.version };
      this.emit({ event: "saved", data: out2 });
      return out2;
    });
  }
  // --- external changes -----------------------------------------------------------------------------------------
  install(file) {
    this.file = file;
    this.doc = EditorDocument.fromText(file.text, { keysFrom: this.baseRefs });
    this.baseRefs = this.doc.refs;
    this.done = [];
    this.undone = [];
    this.marker = null;
    this.conflict = null;
  }
  /** Compare the disk with what we last loaded or wrote, and react (reload silently, or flag a conflict). */
  checkDisk() {
    return this.exclusive(async () => {
      if (this.closed) return;
      let disk;
      try {
        disk = await loadDeck(this.deckPath);
      } catch (e) {
        const gone = e.code === "ENOENT";
        const diskFingerprint2 = gone ? "" : "unreadable";
        if (this.conflict?.diskFingerprint !== diskFingerprint2) {
          this.conflict = { diskFingerprint: diskFingerprint2, ...gone ? { deleted: true } : {} };
          this.emit({ event: "disk-changed", data: { reloaded: false, conflict: true, diskFingerprint: diskFingerprint2, deleted: gone, version: this.version } });
        }
        return;
      }
      if (disk.fingerprint === this.file.fingerprint) {
        if (this.conflict) {
          this.conflict = null;
          this.emit({ event: "disk-changed", data: { reloaded: false, conflict: false, fingerprint: disk.fingerprint, version: this.version } });
        }
        return;
      }
      if (this.doc.text === this.file.text) {
        const before = this.doc.refs;
        this.install(disk);
        const r = this.publish(before, "reload", false);
        this.emit({ event: "disk-changed", data: { reloaded: true, conflict: false, fingerprint: disk.fingerprint, version: r.version } });
      } else if (this.conflict?.diskFingerprint !== disk.fingerprint) {
        this.conflict = { diskFingerprint: disk.fingerprint };
        this.emit({ event: "disk-changed", data: { reloaded: false, conflict: true, diskFingerprint: disk.fingerprint, version: this.version } });
      }
    });
  }
  /** The transactions applied since the last save or load, oldest first; null when undo has gone past that point. */
  unsaved() {
    if (this.marker === null) return this.done;
    const i2 = this.done.indexOf(this.marker);
    return i2 < 0 ? null : this.done.slice(i2 + 1);
  }
  resolve(strategy) {
    return this.exclusive(async () => {
      const entries = strategy === "reapply" ? this.unsaved() : [];
      if (entries === null) {
        throw new HttpError(409, "not-replayable", 'the edits since the last save cannot be replayed (undo went past the save point); use strategy "reload"');
      }
      const disk = await loadDeck(this.deckPath);
      const before = this.doc.refs;
      this.install(disk);
      const failed = [];
      let applied = 0;
      for (const e of entries) {
        try {
          const tx = this.doc.applyKeyed(e.ops, { label: e.label, reuseKeys: e.minted });
          if (tx.forward.flat().length > 0) {
            const prev = this.done[this.done.length - 1];
            if (prev && prev.tx === tx) prev.ops.push(...e.ops);
            else this.done.push({ tx, ops: [...e.ops], label: e.label, minted: this.doc.mintedBy(tx) });
            applied++;
          }
        } catch (err) {
          const code = err instanceof StaleRefError ? "stale-ref" : err instanceof OpError ? err.code : "error";
          failed.push({ label: e.label, ops: e.ops, code, message: err.message });
        }
      }
      this.marker = null;
      const r = this.publish(before, "resolve", false);
      this.emit({ event: "disk-changed", data: { reloaded: true, conflict: false, fingerprint: disk.fingerprint, version: r.version, resolved: strategy } });
      return { version: r.version, applied, failed, dirty: this.isDirty };
    });
  }
};

// src/server/watch.ts
import { statSync, watch } from "node:fs";
import { basename as basename2, dirname as dirname4 } from "node:path";
function watchDeck(deckPath, onChange, debounceMs = 150) {
  const name = basename2(deckPath);
  let timer = null;
  let closed = false;
  const fire = () => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!closed) onChange();
    }, debounceMs);
  };
  const signature2 = () => {
    try {
      const s = statSync(deckPath);
      return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
    } catch {
      return "missing";
    }
  };
  let seen = signature2();
  const observe = () => {
    const next = signature2();
    if (next === seen) return;
    seen = next;
    fire();
  };
  let w = null;
  try {
    w = watch(dirname4(deckPath), { persistent: false }, (_event, file) => {
      if (file === null || file === void 0 || file.toString() === name) observe();
    });
    w.on("error", () => {
    });
  } catch {
    w = null;
  }
  const poll = setInterval(observe, Math.max(25, Math.min(debounceMs, 250)));
  poll.unref();
  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      w?.close();
    }
  };
}

// src/server/uploads.ts
import { mkdir as mkdir3, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname5, join as join6, parse as parse5 } from "node:path";
var TYPES = {
  "image/png": { ext: ".png", matches: (d) => d.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/jpeg": { ext: ".jpg", matches: (d) => d.length > 3 && d[0] === 255 && d[1] === 216 && d[d.length - 2] === 255 && d[d.length - 1] === 217 },
  "image/webp": { ext: ".webp", matches: (d) => d.subarray(0, 4).toString() === "RIFF" && d.subarray(8, 12).toString() === "WEBP" },
  "image/gif": { ext: ".gif", matches: (d) => /^GIF8[79]a$/.test(d.subarray(0, 6).toString()) },
  "image/avif": { ext: ".avif", matches: (d) => d.length > 12 && d.subarray(4, 12).toString().includes("ftyp") && d.subarray(8, 32).includes(Buffer.from("avif")) },
  "image/svg+xml": { ext: ".svg", matches: (d) => /<svg(?:\s|>)/i.test(d.toString("utf8", 0, Math.min(d.length, 4096))) }
};
var MAX_IMAGE = 6 * 1024 * 1024;
var UploadError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
};
function decode(data2) {
  if (typeof data2 !== "string" || data2.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data2) || data2.length % 4 !== 0) {
    throw new UploadError("bad-upload", "image data is not valid base64");
  }
  const out2 = Buffer.from(data2, "base64");
  if (out2.toString("base64").replace(/=+$/, "") !== data2.replace(/=+$/, "")) throw new UploadError("bad-upload", "image data is not valid base64");
  if (out2.length > MAX_IMAGE) throw new UploadError("image-too-large", `image is larger than ${MAX_IMAGE} bytes`);
  return out2;
}
function safeStem(name) {
  const stem = parse5(String(name).replace(/\\/g, "/").split("/").pop() ?? "").name.normalize("NFC").trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[._-]+|[._-]+$/g, "");
  return (stem || "image").slice(0, 80);
}
async function saveUploadedImage(deckPath, input) {
  if (!input || typeof input.name !== "string" || typeof input.type !== "string") throw new UploadError("bad-upload", "image upload requires name, type, and data");
  const rule = TYPES[input.type.toLowerCase()];
  if (!rule) throw new UploadError("unsupported-image", `unsupported image type ${JSON.stringify(input.type)}`);
  const data2 = decode(input.data);
  if (!rule.matches(data2)) throw new UploadError("bad-upload", `image data does not match ${input.type}`);
  if (input.type.toLowerCase() === "image/svg+xml") {
    const svg = data2.toString("utf8");
    if (/<(?:script|foreignObject)(?:\s|>)/i.test(svg) || /\son[a-z]+\s*=/i.test(svg) || /(?:href|src)\s*=\s*["']\s*(?:https?:|data:|\/\/)/i.test(svg)) {
      throw new UploadError("unsafe-svg", "SVG contains active content");
    }
  }
  const assets = join6(dirname5(deckPath), "assets");
  await mkdir3(assets, { recursive: true });
  const stem = safeStem(input.name);
  for (let suffix = 1; suffix < 1e4; suffix++) {
    const name = `${stem}${suffix === 1 ? "" : `-${suffix}`}${rule.ext}`;
    try {
      await writeFile3(join6(assets, name), data2, { flag: "wx" });
      return { path: `assets/${name}`, name, type: input.type.toLowerCase(), size: data2.length };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new UploadError("bad-upload", "could not allocate a unique asset name");
}

// src/server/agent-proposals.ts
import { constants, existsSync as existsSync4, mkdtempSync, readFileSync as readFileSync2, rmSync, statSync as statSync2 } from "node:fs";
import { copyFile as copyFile2, mkdir as mkdir4, unlink as unlink2 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename as basename3, dirname as dirname6, join as join7, resolve as resolve3, sep as sep2 } from "node:path";

// src/cli/unified-diff.ts
function lcsEdits(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > 4e6) return [...a.map((line) => ({ op: "-", line })), ...b.map((line) => ({ op: "+", line }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i3 = n - 1; i3 >= 0; i3--) for (let j2 = m - 1; j2 >= 0; j2--) dp[i3][j2] = a[i3] === b[j2] ? dp[i3 + 1][j2 + 1] + 1 : Math.max(dp[i3 + 1][j2], dp[i3][j2 + 1]);
  const out2 = [];
  let i2 = 0;
  let j = 0;
  while (i2 < n && j < m) {
    if (a[i2] === b[j]) {
      out2.push({ op: " ", line: a[i2] });
      i2++;
      j++;
    } else if (dp[i2 + 1][j] >= dp[i2][j + 1]) out2.push({ op: "-", line: a[i2++] });
    else out2.push({ op: "+", line: b[j++] });
  }
  while (i2 < n) out2.push({ op: "-", line: a[i2++] });
  while (j < m) out2.push({ op: "+", line: b[j++] });
  return out2;
}
function unifiedDiff(before, after, name, context = 3) {
  if (before === after) return "";
  const a = before.split("\n");
  const b = after.split("\n");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const edits = [
    ...a.slice(0, pre).map((line) => ({ op: " ", line })),
    ...lcsEdits(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf)),
    ...a.slice(a.length - suf).map((line) => ({ op: " ", line }))
  ];
  const changed = edits.map((e, i2) => e.op !== " " ? i2 : -1).filter((i2) => i2 >= 0);
  const hunks = [];
  for (const i2 of changed) {
    const s = Math.max(0, i2 - context);
    const e = Math.min(edits.length, i2 + context + 1);
    const last = hunks[hunks.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else hunks.push([s, e]);
  }
  const lines = [`--- a/${name}`, `+++ b/${name}`];
  for (const [s, e] of hunks) {
    let aStart = 1;
    let bStart = 1;
    for (let k = 0; k < s; k++) {
      if (edits[k].op !== "+") aStart++;
      if (edits[k].op !== "-") bStart++;
    }
    const slice = edits.slice(s, e);
    const aLen = slice.filter((x) => x.op !== "+").length;
    const bLen = slice.filter((x) => x.op !== "-").length;
    lines.push(`@@ -${aLen ? aStart : aStart - 1},${aLen} +${bLen ? bStart : bStart - 1},${bLen} @@`);
    for (const x of slice) lines.push(x.op + x.line);
  }
  return lines.join("\n") + "\n";
}

// src/server/agent-proposals.ts
var ALLOWED_ELEMENT_OPS = /* @__PURE__ */ new Set(["setText", "setAttr", "setUtility", "setClasses", "setStyle"]);
function keyedSelectionOps(raw, selection) {
  if (raw.length === 0 || raw.length > 50) throw new Error("the agent must return between 1 and 50 operations");
  return raw.map((item) => {
    validateOp(item);
    const op = item;
    if (!ALLOWED_ELEMENT_OPS.has(op.kind)) throw new Error(`operation ${op.kind} is not allowed in a selection proposal`);
    if (!("id" in op) || op.id !== selection.id) throw new Error("every operation must target the selected element");
    return { ...op, id: selection.key };
  });
}
var AgentProposalStore = class {
  proposals = /* @__PURE__ */ new Map();
  tasks = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  tempDirs = /* @__PURE__ */ new Map();
  imageFiles = /* @__PURE__ */ new Map();
  runners;
  nextId = 1;
  constructor(runners) {
    this.runners = runners;
  }
  createText(prompt, selection) {
    const value = prompt.trim();
    if (!value || value.length > 4e3) throw new Error("the request must contain 1 to 4000 characters");
    const id = `ai-${this.nextId++}`;
    const proposal = {
      id,
      kind: "text",
      status: "running",
      baseVersion: selection.baseVersion,
      selectionKey: selection.key
    };
    const controller = new AbortController();
    this.proposals.set(id, proposal);
    this.controllers.set(id, controller);
    const task = this.runners.text({ prompt: value, selection }, controller.signal).then((result) => {
      if (proposal.status === "rejected") return;
      const ops = keyedSelectionOps(result.ops, selection);
      const isolated = EditorDocument.fromText(selection.source);
      isolated.apply(result.ops, { label: result.summary });
      if (isolated.text === selection.source) throw new Error("the agent proposal does not change the selection");
      proposal.status = "ready";
      proposal.summary = result.summary.trim().slice(0, 500) || value.slice(0, 500);
      proposal.ops = ops;
      proposal.diff = unifiedDiff(selection.source, isolated.text, basename3(selection.deckPath));
    }).catch((error) => {
      if (proposal.status === "rejected") return;
      proposal.status = "failed";
      proposal.error = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.controllers.delete(id);
    });
    this.tasks.set(id, task);
    return { ...proposal };
  }
  createImage(prompt, selection) {
    const value = prompt.trim();
    if (!value || value.length > 4e3) throw new Error("the request must contain 1 to 4000 characters");
    if (selection.tag !== "img") throw new Error("image regeneration requires an image selection");
    if (!this.runners.image) throw new Error("image generation is unavailable");
    const id = `ai-${this.nextId++}`;
    let suffix = 0;
    let assetPath = `assets/ai-${id}.png`;
    while (existsSync4(resolve3(dirname6(selection.deckPath), assetPath))) {
      suffix++;
      assetPath = `assets/ai-${id}-${suffix}.png`;
    }
    const proposal = {
      id,
      kind: "image",
      status: "running",
      baseVersion: selection.baseVersion,
      selectionKey: selection.key
    };
    const dir = mkdtempSync(join7(tmpdir(), "nm-studio-image-"));
    const outputPath = join7(dir, "result.png");
    const root = dirname6(selection.deckPath);
    let referencePath;
    if (selection.src && !/^(?:[a-z]+:|\/\/|#)/i.test(selection.src)) {
      const candidate = resolve3(root, selection.src);
      if ((candidate === root || candidate.startsWith(root + sep2)) && existsSync4(candidate)) referencePath = candidate;
    }
    const controller = new AbortController();
    this.proposals.set(id, proposal);
    this.controllers.set(id, controller);
    this.tempDirs.set(id, dir);
    this.imageFiles.set(id, { temporary: outputPath, target: resolve3(root, assetPath) });
    const task = this.runners.image({ prompt: value, selection, outputPath, ...referencePath ? { referencePath } : {} }, controller.signal).then(() => {
      if (proposal.status === "rejected") return;
      const bytes = readFileSync2(outputPath);
      if (statSync2(outputPath).size > 10 * 1024 * 1024 || bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
        throw new Error("image generator did not produce a valid PNG under 10 MB");
      }
      const raw = [{ kind: "setAttr", id: selection.id, name: "src", value: assetPath }];
      const isolated = EditorDocument.fromText(selection.source);
      isolated.apply(raw, { label: value.slice(0, 500) });
      proposal.status = "ready";
      proposal.summary = value.slice(0, 500);
      proposal.ops = keyedSelectionOps(raw, selection);
      proposal.diff = unifiedDiff(selection.source, isolated.text, basename3(selection.deckPath));
    }).catch((error) => {
      if (proposal.status === "rejected") return;
      proposal.status = "failed";
      proposal.error = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.controllers.delete(id);
    });
    this.tasks.set(id, task);
    return { ...proposal };
  }
  get(id) {
    const proposal = this.proposals.get(id);
    return proposal ? { ...proposal, ...proposal.ops ? { ops: [...proposal.ops] } : {} } : null;
  }
  async settled(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`unknown agent proposal ${id}`);
    await task;
    return this.get(id);
  }
  reject(id) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`unknown agent proposal ${id}`);
    if (proposal.status === "accepted") throw new Error("an accepted proposal cannot be rejected");
    proposal.status = "rejected";
    this.controllers.get(id)?.abort();
    this.cleanupTemp(id);
    return this.get(id);
  }
  markAccepted(id) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`unknown agent proposal ${id}`);
    if (proposal.status !== "ready") throw new Error(`proposal ${id} is not ready for acceptance`);
    proposal.status = "accepted";
    this.cleanupTemp(id);
    return this.get(id);
  }
  async materializeImage(id) {
    const image = this.imageFiles.get(id);
    if (!image) return null;
    await mkdir4(dirname6(image.target), { recursive: true });
    await copyFile2(image.temporary, image.target, constants.COPYFILE_EXCL);
    return image.target;
  }
  async rollbackMaterializedImage(path) {
    if (path) await unlink2(path).catch(() => {
    });
  }
  async close() {
    for (const controller of this.controllers.values()) controller.abort();
    await Promise.allSettled(this.tasks.values());
    for (const id of this.tempDirs.keys()) this.cleanupTemp(id);
    this.controllers.clear();
    this.tasks.clear();
    this.proposals.clear();
  }
  cleanupTemp(id) {
    const dir = this.tempDirs.get(id);
    if (!dir) return;
    rmSync(dir, { recursive: true, force: true });
    this.tempDirs.delete(id);
    this.imageFiles.delete(id);
  }
};

// src/server/local-agent-runner.ts
import { spawn as spawn2 } from "node:child_process";
import { constants as constants2 } from "node:fs";
import { access, chmod as chmod2, mkdtemp, rm, writeFile as writeFile4 } from "node:fs/promises";
import { homedir as homedir3, tmpdir as tmpdir2 } from "node:os";
import { delimiter, dirname as dirname7, join as join8, resolve as resolve4 } from "node:path";
var MAX_OUTPUT = 2 * 1024 * 1024;
var TIMEOUT_MS = 3 * 60 * 1e3;
var RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 500 },
    ops: { type: "array", minItems: 1, maxItems: 50, items: { type: "object" } }
  },
  required: ["summary", "ops"]
};
async function commandAvailable(command) {
  const path = process.env.PATH ?? "";
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    try {
      await access(join8(dir, command), constants2.X_OK);
      return true;
    } catch {
    }
  }
  return false;
}
function runCommand(invocation) {
  return new Promise((resolveResult, reject) => {
    const child = spawn2(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      shell: invocation.shell,
      stdio: ["pipe", "pipe", "pipe"],
      signal: invocation.signal
    });
    let stdout = "";
    let stderr = "";
    const collect = (target, chunk) => {
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > MAX_OUTPUT) child.kill("SIGTERM");
    };
    child.stdout.on("data", (chunk) => collect("stdout", chunk));
    child.stderr.on("data", (chunk) => collect("stderr", chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (stdout.length + stderr.length > MAX_OUTPUT) return reject(new Error("AI process output exceeded 2 MB"));
      if (code !== 0) return reject(new Error(`AI process failed (${signal ?? code}): ${stderr.slice(-2e3)}`));
      resolveResult({ stdout, stderr });
    });
    child.stdin.end(invocation.stdin);
  });
}
function responseObject(value) {
  if (!value || typeof value !== "object") return value;
  const record = value;
  if (record.structured_output !== void 0) return record.structured_output;
  if (typeof record.result === "string") {
    try {
      return JSON.parse(record.result);
    } catch {
      return record.result;
    }
  }
  return value;
}
function parseAgentResponse(output) {
  let parsed;
  try {
    parsed = responseObject(JSON.parse(output.trim()));
  } catch {
    throw new Error("the agent did not return valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("the agent response must be a JSON object");
  const value = parsed;
  if (typeof value.summary !== "string" || value.summary.trim() === "" || value.summary.length > 500) {
    throw new Error("the agent response has an invalid summary");
  }
  if (!Array.isArray(value.ops) || value.ops.length === 0 || value.ops.length > 50) {
    throw new Error("the agent response has an invalid operations list");
  }
  for (const op of value.ops) validateOp(op);
  return { summary: value.summary.trim(), ops: value.ops };
}
function promptFor(input) {
  const selection = input.selection;
  return [
    "You are editing one selected element in a Nevermind Studio HTML slide deck.",
    "Work only in this temporary directory. Do not edit any repository or user file.",
    "Use the supplied nm-studio CLI as your tool: run `./nm-studio inspect deck.html --slide " + selection.slide + " --depth 8`,",
    "check candidate operations by piping them on stdin: `./nm-studio apply deck.html - --dry-run <<'EOF'` ... `EOF`, and run `./nm-studio lint deck.html`.",
    "Your shell can run only ./nm-studio; nothing else is permitted.",
    "Return only JSON matching schema.json. Do not wrap it in Markdown.",
    "Allowed operations: setText, setAttr, setUtility, setClasses, setStyle.",
    `Every operation must target numeric source id ${selection.id}. Do not use structural operations or setToken.`,
    `Selection context: ${JSON.stringify({ id: selection.id, key: selection.key, slide: selection.slide, tag: selection.tag, role: selection.role, text: selection.text, classes: selection.classes, html: selection.html }, null, 2)}`,
    `User request: ${input.prompt}`
  ].join("\n");
}
async function writeCliShim(dir) {
  const cliPath = resolve4(process.argv[1]);
  const shim = join8(dir, "nm-studio");
  const execArgs = process.execArgv.filter((arg) => arg !== "--inspect" && !arg.startsWith("--inspect=")).map((arg) => JSON.stringify(arg)).join(", ");
  const source = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const result = spawnSync(${JSON.stringify(process.execPath)}, [${execArgs}${execArgs ? ", " : ""}${JSON.stringify(cliPath)}, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
`;
  await writeFile4(shim, source, "utf8");
  await chmod2(shim, 448);
}
var AGENT_TOOL_RULE = "Bash(./nm-studio:*)";
function createLocalAgentRunners(options = {}) {
  const available = options.available ?? commandAvailable;
  const run = options.run ?? runCommand;
  return {
    async text(input, outerSignal) {
      const dir = await mkdtemp(join8(tmpdir2(), "nm-studio-ai-"));
      const controller = new AbortController();
      const abort = () => controller.abort(outerSignal.reason);
      outerSignal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error("AI request timed out")), TIMEOUT_MS);
      timer.unref();
      try {
        await Promise.all([
          writeFile4(join8(dir, "deck.html"), input.selection.source, "utf8"),
          writeFile4(join8(dir, "schema.json"), JSON.stringify(RESPONSE_SCHEMA), "utf8"),
          writeCliShim(dir)
        ]);
        const prompt = promptFor(input);
        const env = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}` };
        let invocation;
        if (await available("claude")) {
          invocation = {
            command: "claude",
            args: ["-p", "--bare", "--restricted", "--no-session-persistence", "--permission-mode", "dontAsk", "--allowedTools", AGENT_TOOL_RULE, "--json-schema", JSON.stringify(RESPONSE_SCHEMA), "--output-format", "json"],
            cwd: dir,
            stdin: prompt,
            env,
            shell: false,
            signal: controller.signal
          };
        } else if (await available("codex")) {
          invocation = {
            command: "codex",
            args: ["exec", "--skip-git-repo-check", "--ephemeral", "-C", dir, "-s", "workspace-write", "--output-schema", join8(dir, "schema.json"), "--color", "never", "-"],
            cwd: dir,
            stdin: prompt,
            env,
            shell: false,
            signal: controller.signal
          };
        } else {
          throw new Error("install or sign in to Claude Code or Codex CLI before using AI requests");
        }
        return parseAgentResponse((await run(invocation)).stdout);
      } finally {
        clearTimeout(timer);
        outerSignal.removeEventListener("abort", abort);
        await rm(dir, { recursive: true, force: true });
      }
    },
    async image(input, outerSignal) {
      const controller = new AbortController();
      const abort = () => controller.abort(outerSignal.reason);
      outerSignal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error("image request timed out")), TIMEOUT_MS);
      timer.unref();
      const args = [input.outputPath, input.prompt, ...input.referencePath ? [input.referencePath] : []];
      try {
        await run({
          command: join8(homedir3(), ".claude", "scripts", "codex_image.sh"),
          args,
          cwd: dirname7(input.outputPath),
          stdin: "",
          env: process.env,
          shell: false,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
        outerSignal.removeEventListener("abort", abort);
      }
    }
  };
}

// src/export/chromium.ts
import { spawn as spawn3 } from "node:child_process";
import { existsSync as existsSync5, readdirSync } from "node:fs";
import { mkdtemp as mkdtemp2, rm as rm2, stat as stat2 } from "node:fs/promises";
import { homedir as homedir4, tmpdir as tmpdir3 } from "node:os";
import { join as join9 } from "node:path";
import { pathToFileURL } from "node:url";
var ChromiumError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "ChromiumError";
    this.code = code;
  }
};
function findChrome(env = process.env, exists = existsSync5, list2 = (d) => {
  try {
    return readdirSync(d);
  } catch {
    return [];
  }
}) {
  if (env.NM_CHROME) return exists(env.NM_CHROME) ? env.NM_CHROME : null;
  const fixed = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  for (const path of fixed) if (exists(path)) return path;
  const caches = [env.PLAYWRIGHT_BROWSERS_PATH, join9(homedir4(), "Library/Caches/ms-playwright"), join9(homedir4(), ".cache/ms-playwright")].filter((x) => !!x);
  for (const cache of caches) {
    const dirs = list2(cache).filter((d) => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse();
    for (const dir of dirs) {
      const candidates = [
        join9(cache, dir, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        join9(cache, dir, "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        join9(cache, dir, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"),
        join9(cache, dir, "chrome-linux/chrome"),
        join9(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell"),
        join9(cache, dir, "chrome-headless-shell-mac-x64/chrome-headless-shell"),
        join9(cache, dir, "chrome-headless-shell-linux64/chrome-headless-shell")
      ];
      for (const path of candidates) if (exists(path)) return path;
    }
  }
  return null;
}
function createRunner(children) {
  return (command, args, { timeoutMs }) => new Promise((resolveRun, reject) => {
    const child = spawn3(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"], detached: false });
    children.add(child);
    const out2 = [];
    let err = "";
    let timedOut = false;
    let outBytes = 0;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      outBytes += chunk.length;
      if (outBytes <= 256 * 1024 * 1024) out2.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (err.length < 64 * 1024) err += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      children.delete(child);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      children.delete(child);
      resolveRun({ code, stdout: Buffer.concat(out2), stderr: err, timedOut });
    });
  });
}
var GEOMETRY_MARKER = "nm-geometry";
function chromeArgs(profile, extra, url) {
  return [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-component-update",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    "--font-render-hinting=none",
    "--virtual-time-budget=6000",
    "--run-all-compositor-stages-before-draw",
    `--user-data-dir=${profile}`,
    ...extra,
    url
  ];
}
function createChromiumDriver(options = {}) {
  const children = /* @__PURE__ */ new Set();
  const run = options.run ?? createRunner(children);
  const timeoutMs = options.timeoutMs ?? 9e4;
  const tmpRoot = options.tmpRoot ?? tmpdir3();
  let closed = false;
  const executable = () => {
    const found = options.executable === void 0 ? findChrome() : options.executable;
    if (!found) throw new ChromiumError("no-browser", "No Chrome or Chromium was found. Install Google Chrome, or set NM_CHROME to the executable.");
    return found;
  };
  const launch = async (extra, url) => {
    if (closed) throw new ChromiumError("launch-failed", "The export service is closed.");
    const exe = executable();
    const profile = await mkdtemp2(join9(tmpRoot, "nm-export-profile-"));
    try {
      const result = await run(exe, chromeArgs(profile, extra, url), { timeoutMs });
      if (result.timedOut) throw new ChromiumError("timeout", `Chrome did not finish within ${Math.round(timeoutMs / 1e3)} seconds.`);
      if (result.code !== 0) throw new ChromiumError("launch-failed", `Chrome exited with code ${result.code}: ${result.stderr.trim().split("\n").slice(-3).join(" ")}`);
      return result;
    } finally {
      await rm2(profile, { recursive: true, force: true });
    }
  };
  const expectFile = async (out2) => {
    const info = await stat2(out2).catch(() => null);
    if (!info || info.size === 0) throw new ChromiumError("no-output", `Chrome produced no output at ${out2}.`);
  };
  return {
    async pdf(htmlFile, out2) {
      await launch([`--print-to-pdf=${out2}`, "--no-pdf-header-footer"], pathToFileURL(htmlFile).href);
      await expectFile(out2);
    },
    async png(htmlFile, hash, out2) {
      await launch([`--screenshot=${out2}`], `${pathToFileURL(htmlFile).href}#${hash}`);
      await expectFile(out2);
    },
    async geometry(htmlFile) {
      const result = await launch(["--dump-dom"], `${pathToFileURL(htmlFile).href}#nm-probe`);
      const dom = result.stdout.toString("utf8");
      const match = new RegExp(`<script type="application/json" id="${GEOMETRY_MARKER}">([\\s\\S]*?)</script>`).exec(dom);
      if (!match) throw new ChromiumError("no-output", "The text probe returned nothing.");
      return JSON.parse(match[1].replace(/\\u003c/g, "<"));
    },
    async close() {
      closed = true;
      for (const child of children) child.kill("SIGKILL");
      children.clear();
    }
  };
}

// src/export/service.ts
import { mkdtemp as mkdtemp3, readFile as readFile4, rm as rm3, writeFile as writeFile5 } from "node:fs/promises";
import { tmpdir as tmpdir4 } from "node:os";
import { basename as basename5, extname as extname3, join as join10 } from "node:path";

// src/export/page-runtime.ts
var CAPTURE_CSS = `
*,*::before,*::after{transition:none!important;animation-delay:0s!important;animation-duration:.001s!important;animation-iteration-count:1!important;caret-color:transparent!important}
.reveal,[data-entrance]{opacity:1!important;transform:none!important}
.deck-controls,#counter,.deck-hud,.deck-progress,.nm-export-hide{display:none!important}
html.nm-export-single .slide:not(.active){visibility:hidden!important;opacity:0!important}
html.nm-export-single .slide.active{visibility:visible!important;opacity:1!important}
html.nm-export-notext .slide *:not(svg):not(svg *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}
html.nm-export-notext .slide svg text,html.nm-export-notext .slide svg tspan{fill:transparent!important;stroke:none!important}
@page{size:1920px 1080px;margin:0}
@media print{
  html,body{width:1920px!important;height:auto!important;margin:0!important;overflow:visible!important;background:none!important}
  .deck-viewport{position:static!important;width:auto!important;height:auto!important;overflow:visible!important}
  .deck-stage{position:static!important;width:auto!important;height:auto!important;transform:none!important}
  .slide{position:relative!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:1920px!important;height:1080px!important;break-after:page;page-break-after:always;break-inside:avoid}
  .slide:last-of-type{break-after:auto;page-break-after:auto}
}`.trim();
var CAPTURE_JS = String.raw`
(function () {
  var hash = location.hash.replace(/^#/, '');
  var m = /(?:^|&)nm-slide=(\d+)/.exec(hash);
  var single = m ? parseInt(m[1], 10) - 1 : -1;
  var probe = /(?:^|&)nm-probe(?:&|$)/.test(hash);
  var notext = /(?:^|&)nm-notext(?:&|$)/.test(hash);
  var root = document.documentElement;
  if (notext) root.classList.add('nm-export-notext');
  function slides() { return Array.prototype.slice.call(document.querySelectorAll('.slide')); }
  function select(index) {
    slides().forEach(function (el, i) {
      var on = index < 0 ? true : i === index;
      el.classList.toggle('active', on);
      el.classList.toggle('visible', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }
  function apply() {
    if (single >= 0) { root.classList.add('nm-export-single'); select(single); }
    else if (!probe) { select(-1); }
  }
  function measure() {
    var out = [];
    slides().forEach(function (slide, i) {
      select(i);
      var base = slide.getBoundingClientRect();
      var walker = document.createTreeWalker(slide, NodeFilter.SHOW_ELEMENT);
      var el;
      while ((el = walker.nextNode())) {
        if (el.closest('svg') || /^(SCRIPT|STYLE|IFRAME|NOSCRIPT)$/.test(el.tagName)) continue;
        var own = '';
        for (var c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) own += c.nodeValue;
          else if (c.nodeType === 1 && c.tagName === 'BR') own += '\n';
        }
        own = own.replace(/[ \t\r\f]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
        if (!own) continue;
        var cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        out.push({
          slide: i + 1, text: own,
          x: Math.round((r.left - base.left) * 100) / 100, y: Math.round((r.top - base.top) * 100) / 100,
          width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100,
          fontSize: parseFloat(cs.fontSize) || 32, color: cs.color,
          fontFamily: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(),
          bold: parseInt(cs.fontWeight, 10) >= 600, rtl: cs.direction === 'rtl' || /[؀-ۿ]/.test(own)
        });
      }
    });
    var tag = document.createElement('script');
    tag.type = 'application/json';
    tag.id = 'nm-geometry';
    tag.textContent = JSON.stringify(out).replace(/</g, '\\u003c');
    document.body.appendChild(tag);
  }
  apply();
  window.addEventListener('load', function () {
    apply();
    var done = function () { if (probe) measure(); else apply(); };
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { setTimeout(function () { apply(); setTimeout(done, 300); }, 300); });
  });
})();`.trim();
function withCaptureRuntime(html) {
  const tail = `<style id="nm-export-css">${CAPTURE_CSS}</style><script id="nm-export-js">${CAPTURE_JS.replace(/<\/script/gi, "<\\/script")}</script>`;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i, () => `${tail}</body>`) : `${html}${tail}`;
}

// src/export/portable-html.ts
import { readFile as readFile3, readdir as readdir2, realpath as realpath2, stat as stat3 } from "node:fs/promises";
import { dirname as dirname8, extname as extname2, relative, resolve as resolve5, sep as sep3 } from "node:path";
var PortableExportError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "PortableExportError";
    this.code = code;
  }
};
var MIME = {
  ".avif": "image/avif",
  ".css": "text/css",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};
var FONT_EXT = /* @__PURE__ */ new Set([".otf", ".ttf", ".woff", ".woff2"]);
var REMOTE = /^(?:https?:)?\/\//i;
var SCHEME = /^[a-z][a-z0-9+.-]*:/i;
var LICENCE_NAME = /^(?:ofl(?:-\d+(?:\.\d+)*)?|licen[cs]e(?:[-_.].*)?|copying(?:[-_.].*)?|notice(?:[-_.].*)?)\.?(?:txt|md|html)?$/i;
var MAX_NESTING = 3;
var cleanRef = (ref2) => ref2.trim().replace(/[?#].*$/, "");
var normalPath = (path) => path.split(sep3).join("/");
var attrEscape = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
var blank = (text) => text.replace(/[^\n]/g, " ");
function masked(html, styles) {
  let out2 = html.replace(/<!--[\s\S]*?-->/g, blank);
  out2 = out2.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (_m, a, body, c) => a + blank(body) + c);
  if (styles) out2 = out2.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_m, a, body, c) => a + blank(body) + c);
  return out2;
}
function splice(text, replacements) {
  let out2 = text;
  for (const r of [...replacements].sort((a, b) => b.start - a.start)) out2 = out2.slice(0, r.start) + r.text + out2.slice(r.end);
  return out2;
}
async function createPortableHtml(options) {
  const root = await realpath2(dirname8(resolve5(options.deckPath)));
  const maxAsset = options.maxAssetBytes ?? 25 * 1024 * 1024;
  const maxTotal = options.maxTotalBytes ?? 150 * 1024 * 1024;
  const allowRemote = options.allowRemote ?? false;
  const assets = /* @__PURE__ */ new Map();
  const fonts = /* @__PURE__ */ new Map();
  const remote = /* @__PURE__ */ new Set();
  let aggregate = Buffer.byteLength(options.source);
  const isRemote = (raw) => REMOTE.test(cleanRef(raw));
  const localFile = async (raw, base) => {
    const ref2 = cleanRef(raw);
    if (REMOTE.test(ref2)) throw new PortableExportError("remote-asset", `remote asset cannot be made portable without downloading it: ${raw}`);
    if (SCHEME.test(ref2)) throw new PortableExportError("unsupported-reference", `unsupported asset reference: ${raw}`);
    let decoded;
    try {
      decoded = decodeURIComponent(ref2);
    } catch {
      decoded = ref2;
    }
    const candidate = resolve5(base, decoded);
    if (candidate !== root && !candidate.startsWith(root + sep3)) throw new PortableExportError("outside-root", `asset is outside the deck directory: ${raw}`);
    let path;
    try {
      path = await realpath2(candidate);
    } catch {
      throw new PortableExportError("missing-asset", `asset not found: ${raw}`);
    }
    if (path !== root && !path.startsWith(root + sep3)) throw new PortableExportError("outside-root", `asset is outside the deck directory: ${raw}`);
    const info = await stat3(path);
    if (!info.isFile()) throw new PortableExportError("missing-asset", `asset is not a file: ${raw}`);
    if (info.size > maxAsset) throw new PortableExportError("asset-too-large", `asset exceeds ${maxAsset} bytes: ${raw}`);
    const data2 = await readFile3(path);
    const rel = normalPath(relative(root, path));
    const mime = MIME[extname2(path).toLowerCase()] ?? "application/octet-stream";
    if (!assets.has(rel)) {
      aggregate += data2.length;
      if (aggregate > maxTotal) throw new PortableExportError("export-too-large", `portable export exceeds ${maxTotal} bytes`);
      assets.set(rel, { path: rel, bytes: data2.length, mime });
    }
    return { path, rel, data: data2, mime };
  };
  const licenceFor = async (fontPath) => {
    const dir = dirname8(fontPath);
    const names = await readdir2(dir).catch(() => []);
    const name = names.sort((a, b) => a.localeCompare(b)).find((entry) => LICENCE_NAME.test(entry));
    return name ? normalPath(relative(root, resolve5(dir, name))) : null;
  };
  const dataUrl = async (raw, base) => {
    const value = raw.trim();
    if (/^(?:data:|#|\$\{|\{\{)/i.test(value) || value === "") return raw;
    if (allowRemote && isRemote(value)) {
      remote.add(value);
      return raw;
    }
    const file = await localFile(raw, base);
    if (FONT_EXT.has(extname2(file.path).toLowerCase()) && !fonts.has(file.rel)) {
      const licence = await licenceFor(file.path);
      fonts.set(file.rel, { path: file.rel, licensed: licence !== null, licence });
    }
    return `data:${file.mime};base64,${file.data.toString("base64")}`;
  };
  const inlineCss = async (css, base) => {
    if (/@import\s/i.test(css)) throw new PortableExportError("unsupported-reference", "CSS @import is not supported in portable exports");
    const replacements = [];
    for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
      const raw = match[2];
      if (!raw || /^(?:data:|#)/i.test(raw.trim())) continue;
      const url = await dataUrl(raw, base);
      if (url === raw) continue;
      replacements.push({ start: match.index, end: match.index + match[0].length, text: `url("${url}")` });
    }
    return splice(css, replacements);
  };
  const portable = async (source, base, depth) => {
    let html2 = source;
    {
      const re = /<link\b[^>]*>/gi;
      const reps = [];
      for (const match of masked(html2, true).matchAll(re)) {
        const tag = html2.slice(match.index, match.index + match[0].length);
        const rel = /\brel\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2].toLowerCase() ?? "";
        const href = /\bhref\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag);
        if (!href) continue;
        const kinds = rel.split(/\s+/);
        if (kinds.includes("stylesheet")) {
          if (allowRemote && isRemote(href[2])) {
            remote.add(href[2]);
            continue;
          }
          const file = await localFile(href[2], base);
          const css = await inlineCss(file.data.toString("utf8"), dirname8(file.path));
          reps.push({ start: match.index, end: match.index + tag.length, text: `<style data-nm-inline="${attrEscape(file.rel)}">${css}</style>` });
        } else if (kinds.some((k) => k === "preload" || k === "prefetch" || k === "modulepreload")) {
          if (!isRemote(href[2]) && !/^(?:data:|#)/i.test(href[2].trim())) reps.push({ start: match.index, end: match.index + tag.length, text: "" });
        } else if (kinds.some((k) => k === "icon" || k === "apple-touch-icon" || k === "shortcut")) {
          const url = await dataUrl(href[2], base);
          if (url !== href[2]) {
            const valueStart = match.index + tag.indexOf(href[0]) + href[0].indexOf(href[2]);
            reps.push({ start: valueStart, end: valueStart + href[2].length, text: attrEscape(url) });
          }
        }
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, false).matchAll(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>\s*<\/script\s*>/gi)) {
        if (allowRemote && isRemote(match[3])) {
          remote.add(match[3]);
          continue;
        }
        if (/^(?:data:)/i.test(match[3].trim())) continue;
        const file = await localFile(match[3], base);
        const code = file.data.toString("utf8").replace(/<\/script/gi, "<\\/script");
        const attrs = `${match[1]}${match[4]}`.replace(/\s+/g, " ").trimEnd();
        reps.push({ start: match.index, end: match.index + match[0].length, text: `<script${attrs} data-nm-inline="${attrEscape(file.rel)}">${code}</script>` });
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, false).matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi)) {
        const css = await inlineCss(html2.slice(match.index + match[0].indexOf(">") + 1, match.index + match[0].lastIndexOf("</")), base);
        reps.push({ start: match.index, end: match.index + match[0].length, text: `<style${match[1]}>${css}</style>` });
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, true).matchAll(/\b(style|class)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
        if (!/url\(/i.test(match[3])) continue;
        const original = html2.slice(match.index, match.index + match[0].length);
        const value = original.slice(original.indexOf(match[2]) + 1, original.length - 1);
        const css = match[1].toLowerCase() === "style" ? await inlineCss(value, base) : await (async () => {
          const parts = [];
          for (const u of value.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
            const url = await dataUrl(u[2], base);
            if (url !== u[2]) parts.push({ start: u.index, end: u.index + u[0].length, text: `url(${url})` });
          }
          return splice(value, parts);
        })();
        if (css !== value) reps.push({ start: match.index, end: match.index + match[0].length, text: `${match[1]}=${match[2]}${css}${match[2]}` });
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, true).matchAll(/<iframe\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
        const raw = match[2];
        if (/^(?:data:|#|about:)/i.test(raw.trim()) || raw.trim() === "") continue;
        if (allowRemote && isRemote(raw)) {
          remote.add(raw);
          continue;
        }
        const file = await localFile(raw, base);
        const ext = extname2(file.path).toLowerCase();
        const srcAttr = match[0].slice(match[0].search(/\bsrc\s*=/i));
        if (ext !== ".html" && ext !== ".htm") {
          const url = await dataUrl(raw, base);
          reps.push({ start: match.index + match[0].length - srcAttr.length, end: match.index + match[0].length, text: `src="${attrEscape(url)}"` });
          continue;
        }
        if (depth >= MAX_NESTING) throw new PortableExportError("unsupported-reference", `iframe nesting is deeper than ${MAX_NESTING}: ${raw}`);
        const inner = await portable(file.data.toString("utf8"), dirname8(file.path), depth + 1);
        reps.push({ start: match.index + match[0].length - srcAttr.length, end: match.index + match[0].length, text: `srcdoc="${attrEscape(inner)}"` });
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, true).matchAll(/<(?:img|source|video|audio|track|embed|input|image|use)\b[^>]*?\b(src|href|xlink:href|poster)\s*=\s*(["'])(.*?)\2/gi)) {
        const raw = match[3];
        if (/^(?:data:|#)/i.test(raw.trim())) continue;
        const url = await dataUrl(raw, base);
        if (url === raw) continue;
        const valueStart = match.index + match[0].lastIndexOf(raw);
        reps.push({ start: valueStart, end: valueStart + raw.length, text: attrEscape(url) });
      }
      html2 = splice(html2, reps);
    }
    {
      const reps = [];
      for (const match of masked(html2, true).matchAll(/\bsrcset\s*=\s*(["'])([\s\S]*?)\1/gi)) {
        const parts = [];
        for (const candidate of match[2].split(",")) {
          const parsed = /^\s*(\S+)(\s+.*)?$/.exec(candidate);
          if (!parsed) continue;
          parts.push(`${await dataUrl(parsed[1], base)}${parsed[2] ?? ""}`);
        }
        reps.push({ start: match.index, end: match.index + match[0].length, text: `srcset=${match[1]}${attrEscape(parts.join(", "))}${match[1]}` });
      }
      html2 = splice(html2, reps);
    }
    return html2;
  };
  let html = await portable(options.source, root, 0);
  const warnings = [...fonts.values()].filter((font) => !font.licensed).map((font) => `No licence evidence was found for ${font.path}; embedding does not grant redistribution rights.`);
  const remoteList = [...remote].sort();
  for (const url of remoteList) warnings.push(`${url} is still a remote reference; this file needs a network connection for it.`);
  const sortedAssets = [...assets.values()].sort((a, b) => a.path.localeCompare(b.path));
  const sortedFonts = [...fonts.values()].sort((a, b) => a.path.localeCompare(b.path));
  const metadata = JSON.stringify({ fonts: sortedFonts, remote: remoteList, warnings }).replace(/</g, "\\u003c");
  if (sortedAssets.length) {
    const tag = `<script type="application/json" id="nm-portable-manifest">${metadata}</script>`;
    html = /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, () => `${tag}</head>`) : `${tag}${html}`;
  }
  const outputBytes = Buffer.byteLength(html);
  if (outputBytes > maxTotal * 2) throw new PortableExportError("export-too-large", `encoded portable export exceeds ${maxTotal * 2} bytes`);
  return { html, manifest: { assets: sortedAssets, fonts: sortedFonts, remote: remoteList, warnings, sourceBytes: Buffer.byteLength(options.source), outputBytes } };
}

// src/export/zip.ts
var table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c >>> 1 ^ 3988292384 & -(c & 1);
  table[n] = c >>> 0;
}
function crc32(data2) {
  let crc = 4294967295;
  for (const byte of data2) crc = crc >>> 8 ^ table[(crc ^ byte) & 255];
  return (crc ^ 4294967295) >>> 0;
}
function createZip(entries) {
  const seen = /* @__PURE__ */ new Set();
  const locals = [];
  const centrals = [];
  let offset2 = 0;
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith("/") || entry.name.includes("\\") || entry.name.split("/").includes("..")) throw new Error(`unsafe ZIP entry name: ${entry.name}`);
    if (seen.has(entry.name)) throw new Error(`duplicate ZIP entry: ${entry.name}`);
    seen.add(entry.name);
    const name = Buffer.from(entry.name, "utf8");
    const data2 = typeof entry.data === "string" ? Buffer.from(entry.data) : Buffer.from(entry.data);
    const crc = crc32(data2);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(2162688, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data2.length, 18);
    local.writeUInt32LE(data2.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data2);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(33639248, 0);
    central.writeUInt16LE(788, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(2048, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(2162688, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data2.length, 20);
    central.writeUInt32LE(data2.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(33188 << 16 >>> 0, 38);
    central.writeUInt32LE(offset2, 42);
    centrals.push(central, name);
    offset2 += local.length + name.length + data2.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(101010256, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset2, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// src/export/pptx.ts
var esc = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var emu = (px) => Math.max(0, Math.round(px * 6350));
var xml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
function contentTypes(slides, editable) {
  const slideTypes = Array.from({ length: slides }, (_, i2) => `<Override PartName="/ppt/slides/slide${i2 + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${editable ? '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' : ""}${slideTypes}</Types>`);
}
function slideXml(index, texts, editable) {
  const textShapes = !editable ? "" : texts.map((text, i2) => `<p:sp><p:nvSpPr><p:cNvPr id="${i2 + 3}" name="Editable text ${i2 + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(text.x)}" y="${emu(text.y)}"/><a:ext cx="${emu(text.width)}" cy="${emu(text.height)}"/></a:xfrm><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="${text.rtl ? 1 : 0}"/><a:lstStyle/><a:p>${text.rtl ? '<a:pPr algn="r" rtl="1"/>' : ""}${text.text.split("\n").map((line) => `<a:r><a:rPr lang="${text.rtl ? "ar-SA" : "en-US"}" sz="${Math.round((text.fontSize ?? 32) * 50)}"${text.bold ? ' b="1"' : ""}>${text.color ? `<a:solidFill><a:srgbClr val="${/^[0-9a-f]{6}$/i.test(text.color) ? text.color : "000000"}"/></a:solidFill>` : ""}${text.fontFamily ? `<a:latin typeface="${esc(text.fontFamily)}"/><a:cs typeface="${esc(text.fontFamily)}"/>` : ""}</a:rPr><a:t>${esc(line)}</a:t></a:r>`).join("<a:br/>")}<a:endParaRPr lang="${text.rtl ? "ar-SA" : "en-US"}"/></a:p></p:txBody></p:sp>`).join("");
  return xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Rendered slide ${index}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>${textShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}
function createPptx(options) {
  if (!options.slides.length) throw new Error("PPTX needs at least one slide");
  const slideIds = options.slides.map((_, i2) => `<p:sldId id="${256 + i2}" r:id="rId${i2 + 2}"/>`).join("");
  const presentation = xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  const presentationRels = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${options.slides.map((_, i2) => `<Relationship Id="rId${i2 + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i2 + 1}.xml"/>`).join("")}</Relationships>`);
  const rootRels = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>${options.editable ? '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>' : ""}</Relationships>`);
  const master = xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  const layout = xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`);
  const theme = xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nevermind Studio"><a:themeElements><a:clrScheme name="Default"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>${["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((n) => `<a:${n}><a:srgbClr val="666666"/></a:${n}>`).join("")}</a:clrScheme><a:fontScheme name="Default"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  const entries = [
    { name: "[Content_Types].xml", data: contentTypes(options.slides.length, options.editable) },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/app.xml", data: xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Nevermind Studio</Application><Slides>${options.slides.length}</Slides></Properties>`) },
    { name: "docProps/core.xml", data: xml(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Nevermind Studio</dc:creator><dc:title>Exported presentation</dc:title></cp:coreProperties>`) },
    ...options.editable ? [{ name: "docProps/custom.xml", data: xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="nm-editable-experimental"><vt:bool>true</vt:bool></property></Properties>`) }] : [],
    { name: "ppt/presentation.xml", data: presentation },
    { name: "ppt/_rels/presentation.xml.rels", data: presentationRels },
    { name: "ppt/slideMasters/slideMaster1.xml", data: master },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: layout },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`) },
    { name: "ppt/theme/theme1.xml", data: theme }
  ];
  options.slides.forEach((slide, i2) => {
    entries.push(
      { name: `ppt/slides/slide${i2 + 1}.xml`, data: slideXml(i2 + 1, slide.texts ?? [], options.editable) },
      { name: `ppt/slides/_rels/slide${i2 + 1}.xml.rels`, data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i2 + 1}.png"/></Relationships>`) },
      { name: `ppt/media/image${i2 + 1}.png`, data: slide.png }
    );
  });
  return createZip(entries);
}

// src/export/service.ts
var EXPORT_FORMATS = ["html", "pdf", "png", "pptx", "pptx-editable"];
var ExportError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "ExportError";
    this.code = code;
  }
};
var MIMES = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "pptx-editable": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
var pad = (n) => String(n).padStart(2, "0");
function cssColorToHex(css) {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(css);
  if (!m) return "000000";
  if (m[4] !== void 0 && Number(m[4]) === 0) return null;
  return [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0")).join("");
}
async function pool(items, size, work) {
  let next = 0;
  let failure = null;
  const worker = async () => {
    while (failure === null) {
      const i2 = next++;
      if (i2 >= items.length) return;
      try {
        await work(items[i2]);
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  if (failure !== null) throw failure;
}
var ExportService = class {
  driver;
  tmpRoot;
  concurrency;
  dirs = /* @__PURE__ */ new Set();
  constructor(driver, options = {}) {
    this.driver = driver;
    this.tmpRoot = options.tmpRoot ?? tmpdir4();
    this.concurrency = options.concurrency ?? 3;
  }
  async export(request) {
    if (!EXPORT_FORMATS.includes(request.format)) throw new ExportError("bad-format", `unknown export format: ${request.format}`);
    const source = request.source.replace(/^﻿/, "");
    const slides = inspectDeck(parseSource(source)).slides.length;
    if (slides === 0) throw new ExportError("no-slides", "The deck has no slides to export.");
    const stem = basename5(request.deckPath, extname3(request.deckPath)) || "deck";
    const rendered = request.format !== "html";
    const portable = await createPortableHtml({ deckPath: request.deckPath, source, allowRemote: rendered || request.allowRemote });
    const remoteWarning = / is still a remote reference; /;
    const manifest = rendered ? { ...portable.manifest, remote: [], warnings: portable.manifest.warnings.filter((w) => !remoteWarning.test(w)) } : portable.manifest;
    const common = { format: request.format, slides, warnings: manifest.warnings, manifest, mime: MIMES[request.format] };
    if (request.format === "html") {
      return { ...common, filename: `${stem}.html`, data: Buffer.from(portable.html, "utf8"), experimental: false };
    }
    const dir = await mkdtemp3(join10(this.tmpRoot, "nm-export-"));
    this.dirs.add(dir);
    try {
      const page = join10(dir, "capture.html");
      await writeFile5(page, withCaptureRuntime(portable.html));
      const numbers = Array.from({ length: slides }, (_, i2) => i2 + 1);
      if (request.format === "pdf") {
        const out2 = join10(dir, "deck.pdf");
        await this.driver.pdf(page, out2);
        return { ...common, filename: `${stem}.pdf`, data: await readFile4(out2), experimental: false };
      }
      const shoot = async (hash, name) => {
        const out2 = join10(dir, name);
        await this.driver.png(page, hash, out2);
        return readFile4(out2);
      };
      if (request.format === "png") {
        const pngs2 = /* @__PURE__ */ new Map();
        await pool(numbers, this.concurrency, async (n) => {
          pngs2.set(n, await shoot(`nm-slide=${n}`, `slide-${pad(n)}.png`));
        });
        if (slides === 1) return { ...common, filename: `${stem}-slide-01.png`, data: pngs2.get(1), experimental: false };
        const zip = createZip(numbers.map((n) => ({ name: `${stem}-slide-${pad(n)}.png`, data: pngs2.get(n) })));
        return { ...common, filename: `${stem}-slides.zip`, mime: "application/zip", data: zip, experimental: false };
      }
      const editable = request.format === "pptx-editable";
      const boxes = editable ? await this.driver.geometry(page) : [];
      const pngs = /* @__PURE__ */ new Map();
      await pool(numbers, this.concurrency, async (n) => {
        pngs.set(n, await shoot(editable ? `nm-slide=${n}&nm-notext` : `nm-slide=${n}`, `slide-${pad(n)}.png`));
      });
      const deck = createPptx({
        editable,
        slides: numbers.map((n) => ({
          png: pngs.get(n),
          texts: boxes.filter((box) => box.slide === n).flatMap((box) => {
            const color = cssColorToHex(box.color);
            if (color === null) return [];
            return [{ text: box.text, x: box.x, y: box.y, width: box.width, height: box.height, fontSize: box.fontSize, rtl: box.rtl, color, fontFamily: box.fontFamily, bold: box.bold }];
          })
        }))
      });
      const warnings = editable ? [...manifest.warnings, "Editable PPTX is experimental: text boxes are measured from the rendered slide, and fonts must be installed on the viewing machine."] : manifest.warnings;
      return { ...common, warnings, filename: `${stem}${editable ? "-editable" : ""}.pptx`, data: deck, experimental: editable };
    } finally {
      this.dirs.delete(dir);
      await rm3(dir, { recursive: true, force: true });
    }
  }
  async close() {
    await this.driver.close();
    await Promise.all([...this.dirs].map((dir) => rm3(dir, { recursive: true, force: true })));
    this.dirs.clear();
  }
};

// src/server/exports.ts
import { randomBytes as randomBytes2 } from "node:crypto";
var MAX_JOBS = 6;
var ExportJobs = class {
  jobs = /* @__PURE__ */ new Map();
  files = /* @__PURE__ */ new Map();
  running = /* @__PURE__ */ new Set();
  service;
  constructor(service) {
    this.service = service;
  }
  start(request) {
    const id = `ex-${randomBytes2(9).toString("base64url")}`;
    const job = { id, format: request.format, status: "running", version: request.version, startedAt: Date.now() };
    this.jobs.set(id, job);
    const work = this.service.export({ format: request.format, source: request.source, deckPath: request.deckPath, allowRemote: request.allowRemote }).then((artifact) => {
      this.files.set(id, artifact);
      Object.assign(job, {
        status: "ready",
        filename: artifact.filename,
        mime: artifact.mime,
        bytes: artifact.data.length,
        slides: artifact.slides,
        experimental: artifact.experimental,
        warnings: artifact.warnings,
        remote: artifact.manifest.remote,
        fonts: artifact.manifest.fonts
      });
    }).catch((error) => {
      const code = error instanceof PortableExportError || error instanceof ExportError || error instanceof ChromiumError ? error.code : "export-failed";
      Object.assign(job, { status: "failed", errorCode: code, error: error.message });
    }).finally(() => {
      this.running.delete(work);
    });
    this.running.add(work);
    this.trim();
    return job;
  }
  get(id) {
    return this.jobs.get(id);
  }
  file(id) {
    return this.files.get(id);
  }
  trim() {
    for (const id of [...this.jobs.keys()]) {
      if (this.jobs.size <= MAX_JOBS) break;
      if (this.jobs.get(id)?.status === "running") continue;
      this.jobs.delete(id);
      this.files.delete(id);
    }
  }
  async close() {
    await this.service.close();
    await Promise.allSettled([...this.running]);
    this.jobs.clear();
    this.files.clear();
  }
};
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// src/server/server.ts
var TYPES2 = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".map": "application/json; charset=utf-8"
};
var MAX_BODY = 8 * 1024 * 1024;
var MAX_OPS = 500;
var BASE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin"
};
function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { ...BASE_HEADERS, "content-type": type, ...extra });
  res.end(body);
}
var jsonReplacer = (_k, v) => v instanceof Set ? [...v] : v;
function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value, jsonReplacer), "application/json; charset=utf-8");
}
function publicProposal(proposal) {
  const { ops: _ops, ...publicFields } = proposal;
  return publicFields;
}
var sendError = (res, status, error, message, extra = {}) => sendJson(res, status, { error, message, ...extra });
async function readJson(req) {
  const type = String(req.headers["content-type"] ?? "");
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, "bad-content-type", "send application/json");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, "too-large", `request body over ${MAX_BODY} bytes`);
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    throw new HttpError(400, "bad-json", `body is not valid JSON: ${e.message}`);
  }
}
function parseOpsRequest(body) {
  const b = body;
  if (typeof b !== "object" || b === null || Array.isArray(b)) throw new HttpError(400, "bad-request", "body must be an object");
  if (!Array.isArray(b.ops) || b.ops.some((o) => typeof o !== "object" || o === null || Array.isArray(o))) throw new HttpError(400, "bad-request", "'ops' must be an array of op objects");
  if (b.ops.length > MAX_OPS) throw new HttpError(400, "bad-request", `at most ${MAX_OPS} ops per request`);
  if (!Number.isInteger(b.baseVersion)) throw new HttpError(400, "bad-request", "'baseVersion' (the version the client last saw) is required");
  for (const f of ["label", "coalesceKey", "clientId"]) {
    if (b[f] !== void 0 && (typeof b[f] !== "string" || b[f].length > 200)) throw new HttpError(400, "bad-request", `'${f}' must be a string of at most 200 characters`);
  }
  return { ops: b.ops, baseVersion: b.baseVersion, label: b.label, coalesceKey: b.coalesceKey, clientId: b.clientId };
}
async function serveFile(req, res, file) {
  const st = await stat4(file).catch(() => null);
  if (!st || !st.isFile()) return sendError(res, 404, "not-found", "no such file");
  const type = TYPES2[extname4(file).toLowerCase()] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const headers = { ...BASE_HEADERS, "content-type": type, "accept-ranges": "bytes" };
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { ...headers, "content-range": `bytes */${st.size}` });
      return void res.end();
    }
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${st.size}`;
  }
  headers["content-length"] = String(end - start + 1);
  res.writeHead(status, headers);
  if (req.method === "HEAD") return void res.end();
  createReadStream(file, { start, end }).on("error", () => res.destroy()).pipe(res);
}
async function startEditorServer(opts) {
  const deckPath = await realpath3(resolve6(opts.deckPath));
  const root = dirname9(deckPath);
  const session = await Session.open(deckPath);
  const notes2 = await NotesStore.open(deckPath);
  const proposals = new AgentProposalStore(opts.agentRunners ?? createLocalAgentRunners());
  const exportJobs = new ExportJobs(new ExportService(opts.exportDriver ?? createChromiumDriver()));
  const token = randomBytes3(24).toString("base64url");
  const guard = { port: 0, token };
  const sse = /* @__PURE__ */ new Set();
  const broadcast = (event, data2) => {
    const frame = `event: ${event}
data: ${JSON.stringify(data2)}

`;
    for (const response of sse) response.write(frame);
  };
  session.subscribe((e) => {
    broadcast(e.event, e.data);
  });
  notes2.subscribe((document, source) => {
    broadcast("notes", { notes: document, source });
  });
  const authed = (req, res, url2, allowCookie = false) => {
    const v = checkToken(req, url2, guard, allowCookie);
    if (!v.ok) sendError(res, v.status, v.error, v.message);
    return v.ok;
  };
  const setCookie = (res) => res.setHeader("set-cookie", `${cookieName(guard.port)}=${token}; Path=/deck/; HttpOnly; SameSite=Strict`);
  async function route(req, res) {
    let url2;
    try {
      url2 = new URL(req.url ?? "/", "http://127.0.0.1");
    } catch {
      return sendError(res, 400, "bad-url", "malformed URL");
    }
    const path = url2.pathname;
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD" && method !== "POST") return sendError(res, 405, "method", `${method} not allowed`);
    if (path.startsWith("/deck/")) {
      if (method === "POST") return sendError(res, 405, "method", "POST not allowed here");
      if (!authed(req, res, url2, true)) return;
      const file = await resolveUnder(root, path.slice("/deck/".length));
      if (!file) return sendError(res, 403, "forbidden", "path is outside the deck directory");
      return serveFile(req, res, file);
    }
    if (path.startsWith("/ui/fonts/")) {
      if (method === "POST") return sendError(res, 405, "method", "POST not allowed here");
      if (!authed(req, res, url2, true)) return;
      const name = path.slice("/ui/fonts/".length);
      if (!UI_FONT_FILES.has(name)) return sendError(res, 404, "not-found", "no such font");
      const dir = uiFontsDir();
      if (!dir) return sendError(res, 404, "not-found", "the editor fonts are not installed");
      const file = await resolveUnder(dir, name);
      if (!file) return sendError(res, 403, "forbidden", "path is outside the font directory");
      return serveFile(req, res, file);
    }
    if (method === "GET" && (path === "/" || path === "/index.html")) {
      if (!authed(req, res, url2)) return;
      setCookie(res);
      return send(res, 200, await shellHtml(), TYPES2[".html"], { "content-security-policy": "frame-ancestors 'self'" });
    }
    if (method === "GET" && (path === "/preview" || path === "/thumbnail")) {
      if (!authed(req, res, url2)) return;
      setCookie(res);
      const snap = session.snapshot();
      const html = buildPreview(snap.doc, snap.refs, { css: EDIT_MODE_CSS, js: EDIT_MODE_JS }, snap.version);
      return send(res, 200, html, TYPES2[".html"], { "x-nm-version": String(snap.version), "x-frame-options": "SAMEORIGIN" });
    }
    if (!path.startsWith("/api/")) return sendError(res, 404, "not-found", "no such route");
    if (!authed(req, res, url2)) return;
    if (method === "GET" && path === "/api/state") return sendJson(res, 200, { ...session.state(), notes: notes2.read() });
    if (method === "GET" && path === "/api/notes") return sendJson(res, 200, notes2.read());
    if (method === "GET" && path === "/api/layout-presets") return sendJson(res, 200, { presets: listLayoutPresets() });
    if (method === "GET" && path === "/api/layout-preset") {
      const id = url2.searchParams.get("id");
      if (!id) throw new HttpError(400, "bad-request", "layout preset id is required");
      try {
        return sendJson(res, 200, readLayoutPreset(id));
      } catch (error) {
        if (error instanceof LayoutPresetError) throw new HttpError(error.code === "unknown-preset" ? 404 : error.code === "missing-presets" ? 503 : 422, error.code, error.message);
        throw error;
      }
    }
    if (method === "GET" && path === "/api/outline") {
      const num = (name, def) => {
        const v = url2.searchParams.get(name);
        if (v === null) return def;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new HttpError(400, "bad-request", `${name} must be a non-negative integer`);
        return n;
      };
      return sendJson(res, 200, session.outline(num("slide", 1), num("depth", 4)));
    }
    if (method === "GET" && path === "/api/events") {
      res.writeHead(200, { ...BASE_HEADERS, "content-type": "text/event-stream; charset=utf-8", connection: "keep-alive" });
      res.write(": connected\n\n");
      res.write(`event: hello
data: ${JSON.stringify({ version: session.currentVersion, dirty: session.isDirty })}

`);
      sse.add(res);
      const beat = setInterval(() => res.write(": ping\n\n"), 15e3);
      beat.unref();
      req.on("close", () => {
        clearInterval(beat);
        sse.delete(res);
      });
      return;
    }
    if (method === "POST" && path === "/api/exports") {
      const body = await readJson(req);
      if (!body || typeof body !== "object" || typeof body.format !== "string" || !EXPORT_FORMATS.includes(body.format)) {
        throw new HttpError(400, "bad-format", `format must be one of ${EXPORT_FORMATS.join(", ")}`);
      }
      if (body.allowRemote !== void 0 && typeof body.allowRemote !== "boolean") throw new HttpError(400, "bad-request", "'allowRemote' must be a boolean");
      const snapshot = session.exportSource();
      const job = exportJobs.start({ format: body.format, source: snapshot.text, version: snapshot.version, deckPath, allowRemote: body.allowRemote === true });
      return sendJson(res, 202, job);
    }
    const exportRoute = /^\/api\/exports\/(ex-[A-Za-z0-9_-]+)(\/download)?$/.exec(path);
    if (exportRoute && method === "GET") {
      const job = exportJobs.get(exportRoute[1]);
      if (!job) throw new HttpError(404, "unknown-export", "no such export");
      if (!exportRoute[2]) return sendJson(res, 200, job);
      const artifact = exportJobs.file(job.id);
      if (job.status !== "ready" || !artifact) throw new HttpError(409, "export-not-ready", "the export is not ready");
      return send(res, 200, artifact.data, artifact.mime, { "content-disposition": contentDisposition(artifact.filename), "content-length": String(artifact.data.length) });
    }
    if (method === "POST" && path === "/api/ops") return sendJson(res, 200, session.applyOps(parseOpsRequest(await readJson(req))));
    if (method === "POST" && path === "/api/ai/requests") {
      const body = await readJson(req);
      if (!body || typeof body.prompt !== "string" || typeof body.key !== "string" || body.kind !== "text" && body.kind !== "image") {
        throw new HttpError(400, "bad-request", 'AI request requires prompt, selection key, and kind "text" or "image"');
      }
      let proposal;
      try {
        const selection = session.agentSelection(body.key);
        proposal = body.kind === "image" ? proposals.createImage(body.prompt, selection) : proposals.createText(body.prompt, selection);
      } catch (error) {
        throw new HttpError(400, "bad-ai-request", error.message);
      }
      return sendJson(res, 202, publicProposal(proposal));
    }
    const aiRoute = /^\/api\/ai\/requests\/(ai-[0-9]+)(?:\/(accept|reject))?$/.exec(path);
    if (aiRoute && method === "GET" && !aiRoute[2]) {
      const proposal = proposals.get(aiRoute[1]);
      if (!proposal) throw new HttpError(404, "unknown-proposal", "no such AI proposal");
      return sendJson(res, 200, publicProposal(proposal));
    }
    if (aiRoute && method === "POST" && aiRoute[2] === "reject") {
      await readJson(req);
      try {
        return sendJson(res, 200, publicProposal(proposals.reject(aiRoute[1])));
      } catch (error) {
        throw new HttpError(409, "proposal-state", error.message);
      }
    }
    if (aiRoute && method === "POST" && aiRoute[2] === "accept") {
      await readJson(req);
      const proposal = proposals.get(aiRoute[1]);
      if (!proposal) throw new HttpError(404, "unknown-proposal", "no such AI proposal");
      if (proposal.status !== "ready" || !proposal.ops) throw new HttpError(409, "proposal-state", "the AI proposal is not ready");
      let materialized = null;
      try {
        materialized = await proposals.materializeImage(proposal.id);
        const result = session.acceptAgentOps({ baseVersion: proposal.baseVersion, ops: proposal.ops, label: `AI: ${proposal.summary ?? "selection change"}` });
        proposals.markAccepted(proposal.id);
        return sendJson(res, 200, { proposal: publicProposal(proposals.get(proposal.id)), result });
      } catch (error) {
        await proposals.rollbackMaterializedImage(materialized);
        throw error;
      }
    }
    if (method === "POST" && path === "/api/assets") {
      try {
        return sendJson(res, 201, await saveUploadedImage(deckPath, await readJson(req)));
      } catch (error) {
        if (error instanceof UploadError) {
          const status = error.code === "unsupported-image" ? 415 : error.code === "image-too-large" ? 413 : 400;
          throw new HttpError(status, error.code, error.message);
        }
        throw error;
      }
    }
    if (method === "POST" && path === "/api/notes") {
      const body = await readJson(req);
      if (!body || typeof body !== "object" || typeof body.text !== "string" || !body.target || typeof body.target !== "object") {
        throw new HttpError(400, "bad-request", "note requires text and a target object");
      }
      let target;
      if (body.target.kind === "element") {
        if (typeof body.target.key !== "string") throw new HttpError(400, "bad-request", "element target requires key");
        target = session.noteTarget(body.target.key);
      } else if (body.target.kind === "area") {
        const slide = body.target.slide;
        const rect = body.target.rect;
        if (!Number.isInteger(slide) || !rect || typeof rect !== "object") throw new HttpError(400, "bad-request", "area target requires slide and rect");
        const title = session.state().info.slides[slide - 1]?.title;
        target = { kind: "area", slide, ...title ? { slideTitle: title } : {}, rect };
      } else {
        throw new HttpError(400, "bad-request", "target kind must be element or area");
      }
      const note = await notes2.create({ text: body.text, target });
      return sendJson(res, 201, { note, notes: notes2.read() });
    }
    if (method === "POST" && path === "/api/notes/done") {
      const body = await readJson(req);
      if (!body || typeof body.id !== "string") throw new HttpError(400, "bad-request", "notes done requires id");
      const note = await notes2.done(body.id);
      return sendJson(res, 200, { note, notes: notes2.read() });
    }
    if (method === "POST" && path === "/api/current") {
      const body = await readJson(req);
      if (!body || !Number.isInteger(body.slide) || body.key !== void 0 && typeof body.key !== "string") {
        throw new HttpError(400, "bad-request", "current context requires slide and optional key");
      }
      const state = session.state();
      const slide = body.slide;
      if (!state.info.slides[slide - 1]) throw new HttpError(400, "bad-slide", `slide ${slide}: the deck has ${state.info.slides.length} slides`);
      const selection = typeof body.key === "string" ? session.noteTarget(body.key) : null;
      if (selection && selection.slide !== slide) throw new HttpError(400, "bad-note-target", "selected element is not on the current slide");
      return sendJson(res, 200, await notes2.writeCurrent({ fingerprint: state.fingerprint, slide, selection }));
    }
    if (method === "POST" && path === "/api/undo") {
      await readJson(req);
      return sendJson(res, 200, session.undo());
    }
    if (method === "POST" && path === "/api/redo") {
      await readJson(req);
      return sendJson(res, 200, session.redo());
    }
    if (method === "POST" && path === "/api/save") {
      await readJson(req);
      return sendJson(res, 200, await session.save());
    }
    if (method === "POST" && path === "/api/resolve") {
      const b = await readJson(req);
      if (b?.strategy !== "reload" && b?.strategy !== "reapply") throw new HttpError(400, "bad-request", `'strategy' must be "reload" or "reapply"`);
      return sendJson(res, 200, await session.resolve(b.strategy));
    }
    return sendError(res, 404, "not-found", "no such route");
  }
  const server = createServer((req, res) => {
    const v = checkRequest(req, guard);
    if (!v.ok) return sendError(res, v.status, v.error, v.message);
    route(req, res).catch((e) => {
      if (res.headersSent) return void res.destroy();
      if (e instanceof HttpError) return sendError(res, e.status, e.code, e.message, e.extra);
      if (e instanceof NotesError) return sendError(res, e.code === "unknown-note" ? 404 : 400, e.code, e.message);
      if (e instanceof OpError) return sendError(res, 422, "op-error", e.message, { opCode: e.code });
      process.stderr.write(`nm-studio: internal error: ${e.stack ?? e}
`);
      sendError(res, 500, "internal", "internal error");
    });
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(opts.port ?? 0, "127.0.0.1", () => ok());
  });
  const addr = server.address();
  guard.port = typeof addr === "object" && addr ? addr.port : opts.port ?? 0;
  const watcher = watchDeck(deckPath, () => {
    session.checkDisk().catch(() => {
    });
  });
  const url = `http://127.0.0.1:${guard.port}/?t=${token}`;
  if (opts.open) openBrowser(url);
  return {
    url,
    port: guard.port,
    token,
    close: async () => {
      watcher.close();
      notes2.close();
      await proposals.close();
      await exportJobs.close();
      session.close();
      for (const r of sse) r.end();
      sse.clear();
      server.closeAllConnections();
      await new Promise((ok) => server.close(() => ok()));
    }
  };
}

// src/cli/nm-studio.ts
var USAGE = `usage:
  nm-studio inspect <deck.html> [--slide N] [--depth D]
  nm-studio apply <deck.html> <ops.json | -> [--dry-run] [--expect <fingerprint>] [--label <text>]
  nm-studio lint <deck.html>
  nm-studio undo <deck.html>
  nm-studio notes list <deck.html> [--all]
  nm-studio notes done <deck.html> <note-id>
  nm-studio export <deck.html> --format <html|pdf|png|pptx|pptx-editable> --out <path> [--allow-remote]
  nm-studio edit <deck.html> [--port N] [--no-open]`;
var VERSION = "0.1.0";
var UsageError = class extends Error {
};
function parseArgs(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  const valued = /* @__PURE__ */ new Set(["--slide", "--depth", "--expect", "--label", "--port", "--format", "--out"]);
  for (let i2 = 0; i2 < argv.length; i2++) {
    const a = argv[i2];
    if (a.startsWith("--")) {
      if (valued.has(a)) {
        if (i2 + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
        flags.set(a, argv[++i2]);
      } else if (a === "--dry-run" || a === "--no-open" || a === "--all" || a === "--allow-remote") flags.set(a, true);
      else throw new UsageError(`unknown option ${a}`);
    } else positional.push(a);
  }
  return { positional, flags };
}
var out = (v) => process.stdout.write(JSON.stringify(v, (_k, x) => x instanceof Set ? [...x] : x, 2) + "\n");
function intFlag(args, name, def) {
  const v = args.flags.get(name);
  if (v === void 0) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`${name} must be a non-negative integer`);
  return n;
}
async function inspect(args) {
  const file = await loadDeck(args.positional[1]);
  const ed = EditorDocument.fromText(file.text);
  const info = { ...inspectDeck(ed.doc), fingerprint: file.fingerprint };
  if (args.flags.has("--slide")) {
    const n = intFlag(args, "--slide", 1);
    const slide = info.slides[n - 1];
    if (!slide) throw new UsageError(`--slide ${n}: the deck has ${info.slides.length} slides (numbered from 1)`);
    info.outline = outline(ed.doc, slide.id, intFlag(args, "--depth", 4));
  }
  out(info);
  return 0;
}
function readOps(source) {
  const raw = source === "-" ? readFileSync3(0, "utf8") : readFileSync3(source, "utf8");
  let data2;
  try {
    data2 = JSON.parse(raw);
  } catch (e) {
    throw new UsageError(`ops are not valid JSON: ${e.message}`);
  }
  if (Array.isArray(data2)) return { ops: data2 };
  if (data2 && typeof data2 === "object" && Array.isArray(data2.ops)) {
    const d = data2;
    return { ops: d.ops, label: typeof d.label === "string" ? d.label : void 0 };
  }
  if (data2 && typeof data2 === "object" && "kind" in data2) return { ops: [data2] };
  throw new UsageError('ops JSON must be an array of ops, one op, or { "ops": [...], "label": "..." }');
}
async function apply(args) {
  const [, deck, opsSource] = args.positional;
  if (!opsSource) throw new UsageError("apply needs <deck.html> and <ops.json | ->");
  const { ops, label } = readOps(opsSource);
  const file = await loadDeck(deck);
  const expect = args.flags.get("--expect");
  if (typeof expect === "string" && expect !== file.fingerprint) {
    throw new ConflictError(deck, expect, file.fingerprint);
  }
  const ed = EditorDocument.fromText(file.text);
  const flagLabel = args.flags.get("--label");
  const tx = ed.apply(ops, { label: typeof flagLabel === "string" ? flagLabel : label });
  if (args.flags.has("--dry-run")) {
    process.stdout.write(unifiedDiff(file.text, ed.text, basename6(deck)));
    return 0;
  }
  const saved = await saveDeck(file, ed.text);
  const splices = tx.forward.flat();
  const changedBytes = tx.forward.flat().reduce((s, sp) => s + Buffer.byteLength(sp.text), 0) + tx.inverse.flat().reduce((s, sp) => s + Buffer.byteLength(sp.text), 0);
  out({ changedBytes, splices: splices.length, fingerprint: saved.fingerprint });
  return 0;
}
async function lint(args) {
  const deck = args.positional[1];
  const file = await loadDeck(deck);
  const ed = EditorDocument.fromText(file.text);
  const issues = lintDeck(ed.doc, inspectDeck(ed.doc), dirname10(resolve7(deck)));
  out(issues);
  return issues.some((i2) => i2.severity === "error") ? 1 : 0;
}
async function undo(args) {
  const r = await restoreLatestSnapshot(args.positional[1]);
  if (!r) throw new Error(`no snapshot to restore for ${args.positional[1]}`);
  out({ restored: r.restored, fingerprint: r.file.fingerprint });
  return 0;
}
async function notes(args) {
  const [, action, deck, id] = args.positional;
  if (action !== "list" && action !== "done") throw new UsageError("notes needs list or done");
  if (!deck) throw new UsageError(`notes ${action} needs <deck.html>`);
  await loadDeck(deck);
  const store = await NotesStore.open(resolve7(deck));
  try {
    if (action === "list") {
      const document = store.read();
      out(args.flags.has("--all") ? document : { ...document, notes: document.notes.filter((note2) => note2.status === "open") });
      return 0;
    }
    if (!id) throw new UsageError("notes done needs <deck.html> and <note-id>");
    const note = await store.done(id);
    out({ note, notes: store.read() });
    return 0;
  } finally {
    store.close();
  }
}
async function exportDeck(args) {
  const format = args.flags.get("--format");
  const outPath = args.flags.get("--out");
  if (typeof format !== "string" || !EXPORT_FORMATS.includes(format)) throw new UsageError(`--format must be one of ${EXPORT_FORMATS.join(", ")}`);
  if (typeof outPath !== "string") throw new UsageError("export needs --out <path>");
  const file = await loadDeck(args.positional[1]);
  const service = new ExportService(createChromiumDriver());
  try {
    const artifact = await service.export({ format, source: file.text, deckPath: resolve7(args.positional[1]), allowRemote: args.flags.has("--allow-remote") });
    await writeFile6(resolve7(outPath), artifact.data);
    out({
      format: artifact.format,
      out: resolve7(outPath),
      bytes: artifact.data.length,
      slides: artifact.slides,
      experimental: artifact.experimental,
      remote: artifact.manifest.remote,
      warnings: artifact.warnings
    });
    for (const warning of artifact.warnings) process.stderr.write(`nm-studio: warning: ${warning}
`);
    return 0;
  } finally {
    await service.close();
  }
}
async function edit(args) {
  const deck = resolve7(args.positional[1]);
  await loadDeck(deck);
  const port = args.flags.has("--port") ? intFlag(args, "--port", 0) : void 0;
  if (port !== void 0 && port > 65535) throw new UsageError("--port must be between 0 and 65535");
  const server = await startEditorServer({ deckPath: deck, port, open: !args.flags.has("--no-open") });
  out({ url: server.url, port: server.port, deck });
  process.stderr.write(`nm-studio: editing ${basename6(deck)} at ${server.url}
nm-studio: Ctrl+C to stop
`);
  await new Promise((done) => {
    const stop = () => {
      void server.close().then(() => done());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  return 0;
}
async function main(argv) {
  try {
    if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
      process.stdout.write(`${VERSION}
`);
      return 0;
    }
    const args = parseArgs(argv);
    const [cmd, deck] = args.positional;
    if (!cmd || cmd === "help" || cmd === "--help") {
      process.stderr.write(USAGE + "\n");
      return cmd ? 0 : 1;
    }
    if (!deck) throw new UsageError(`${cmd} needs <deck.html>`);
    switch (cmd) {
      case "inspect":
        return await inspect(args);
      case "apply":
        return await apply(args);
      case "lint":
        return await lint(args);
      case "undo":
        return await undo(args);
      case "notes":
        return await notes(args);
      case "export":
        return await exportDeck(args);
      case "edit":
        return await edit(args);
      default:
        throw new UsageError(`unknown command ${cmd}`);
    }
  } catch (e) {
    if (e instanceof UsageError) process.stderr.write(`nm-studio: ${e.message}
${USAGE}
`);
    else if (e instanceof OpError) process.stderr.write(`nm-studio: [${e.code}] ${e.message}
`);
    else if (e instanceof ConflictError) process.stderr.write(`nm-studio: [conflict] ${e.message}
`);
    else process.stderr.write(`nm-studio: ${e.message ?? String(e)}
`);
    return 1;
  }
}
var isMain = import.meta.main ?? (process.argv[1] !== void 0 && realpathSync2(process.argv[1]) === realpathSync2(fileURLToPath(import.meta.url)));
if (isMain) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
export {
  main
};
