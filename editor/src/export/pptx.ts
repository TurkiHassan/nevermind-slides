import { createZip, type ZipEntry } from './zip.ts';

export interface PptxText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  rtl?: boolean;
  /** RRGGBB, no hash. */
  color?: string;
  fontFamily?: string;
  bold?: boolean;
}
export interface PptxSlide { png: Buffer; texts?: PptxText[] }
export interface PptxOptions { slides: PptxSlide[]; editable: boolean }

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emu = (px: number) => Math.max(0, Math.round(px * 6350));
const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;

function contentTypes(slides: number, editable: boolean): string {
  const slideTypes = Array.from({ length: slides }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${editable ? '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' : ''}${slideTypes}</Types>`);
}

function slideXml(index: number, texts: PptxText[], editable: boolean): string {
  const textShapes = !editable ? '' : texts.map((text, i) => `<p:sp><p:nvSpPr><p:cNvPr id="${i + 3}" name="Editable text ${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(text.x)}" y="${emu(text.y)}"/><a:ext cx="${emu(text.width)}" cy="${emu(text.height)}"/></a:xfrm><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="${text.rtl ? 1 : 0}"/><a:lstStyle/><a:p>${text.rtl ? '<a:pPr algn="r" rtl="1"/>' : ''}${text.text.split('\n').map((line) => `<a:r><a:rPr lang="${text.rtl ? 'ar-SA' : 'en-US'}" sz="${Math.round((text.fontSize ?? 32) * 50)}"${text.bold ? ' b="1"' : ''}>${text.color ? `<a:solidFill><a:srgbClr val="${/^[0-9a-f]{6}$/i.test(text.color) ? text.color : '000000'}"/></a:solidFill>` : ''}${text.fontFamily ? `<a:latin typeface="${esc(text.fontFamily)}"/><a:cs typeface="${esc(text.fontFamily)}"/>` : ''}</a:rPr><a:t>${esc(line)}</a:t></a:r>`).join('<a:br/>')}<a:endParaRPr lang="${text.rtl ? 'ar-SA' : 'en-US'}"/></a:p></p:txBody></p:sp>`).join('');
  return xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Rendered slide ${index}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>${textShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}

export function createPptx(options: PptxOptions): Buffer {
  if (!options.slides.length) throw new Error('PPTX needs at least one slide');
  const slideIds = options.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const presentation = xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  const presentationRels = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${options.slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`);
  const rootRels = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>${options.editable ? '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>' : ''}</Relationships>`);
  const master = xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  const layout = xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`);
  const theme = xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nevermind Studio"><a:themeElements><a:clrScheme name="Default"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>${['accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].map((n) => `<a:${n}><a:srgbClr val="666666"/></a:${n}>`).join('')}</a:clrScheme><a:fontScheme name="Default"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: contentTypes(options.slides.length, options.editable) },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/app.xml', data: xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Nevermind Studio</Application><Slides>${options.slides.length}</Slides></Properties>`) },
    { name: 'docProps/core.xml', data: xml(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Nevermind Studio</dc:creator><dc:title>Exported presentation</dc:title></cp:coreProperties>`) },
    ...(options.editable ? [{ name: 'docProps/custom.xml', data: xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="nm-editable-experimental"><vt:bool>true</vt:bool></property></Properties>`) }] : []),
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: presentationRels },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: master },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: layout },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`) },
    { name: 'ppt/theme/theme1.xml', data: theme },
  ];
  options.slides.forEach((slide, i) => {
    entries.push(
      { name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(i + 1, slide.texts ?? [], options.editable) },
      { name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.png"/></Relationships>`) },
      { name: `ppt/media/image${i + 1}.png`, data: slide.png },
    );
  });
  return createZip(entries);
}
