
import bcp47 = require('bcp47');
import stable = require('stable');

interface LanguageTagWithValue extends bcp47.LanguageTag {
    value: string;
}

class AcceptLanguage {
    private languageTagsWithValues: {
        [index: string]: [LanguageTagWithValue];
    } = {};

    private defaultLanguageTag: string | null = null;

    public languages(definedLanguages: string[]) {
        if (definedLanguages.length < 1) {
            throw new Error('The number of defined languages cannot be smaller than one.');
        }

        this.languageTagsWithValues = {};
        definedLanguages.forEach((languageTagString) => {
            const languageTag = bcp47.parse(languageTagString);
            if (!languageTag) {
                throw new TypeError('Language tag ' + languageTagString + ' is not bcp47 compliant. For more info https://tools.ietf.org/html/bcp47.');
            }
            const language = languageTag.langtag.language.language;
            if (!language) {
                throw new TypeError('Language tag ' + languageTagString + ' is not supported.');
            }
            const langtag = languageTag.langtag;
            let languageTagWithValues: LanguageTagWithValue = langtag as LanguageTagWithValue;
            languageTagWithValues.value = languageTagString;
            if (!this.languageTagsWithValues[language]) {
                this.languageTagsWithValues[language] = [languageTagWithValues];
            }
            else {
                this.languageTagsWithValues[language].push(languageTagWithValues);
            }
        });

        this.defaultLanguageTag = definedLanguages[0];
    }

    public get(languagePriorityList: string | null | undefined): string | null {
        return this.parse(languagePriorityList)[0];
    }

    public create(): this {
        return null as any;
    }

    private parse(languagePriorityList: string | null | undefined): (string | null)[] {
        if (!languagePriorityList) {
            return [this.defaultLanguageTag];
        }
        const parsedAndSortedLanguageTags = parseAndSortLanguageTags(languagePriorityList);
        const result: string[] = [];
        for (const languageTag of parsedAndSortedLanguageTags) {
            const requestedLang = bcp47.parse(languageTag.tag);

            if (!requestedLang) {
                continue;
            }

            const requestedLangTag = requestedLang.langtag;

            if (!this.languageTagsWithValues[requestedLangTag.language.language]) {
                continue;
            }

            middle:
            for (const definedLangTag of this.languageTagsWithValues[requestedLangTag.language.language]) {
                for (const prop of ['privateuse', 'extension', 'variant', 'region', 'script']) {

                    // Continue fast.
                    const definedLanguagePropertValue = (definedLangTag as any)[prop];
                    if (!definedLanguagePropertValue) {
                        continue;
                    }

                    // Filter out wider requested languages first. If someone requests 'zh'
                    // and my defined language is 'zh-Hant'. I cannot match 'zh-Hant', because
                    // 'zh' is wider than 'zh-Hant'.
                    const requestedLanguagePropertyValue = (requestedLangTag as any)[prop];
                    if (definedLanguagePropertValue && !requestedLanguagePropertyValue) {
                        continue middle;
                    }
                    else if (prop === 'privateuse' || prop === 'variant') {
                        for (let i = 0; i < definedLanguagePropertValue.length; i++) {
                            if (definedLanguagePropertValue[i] !== requestedLanguagePropertyValue[i]) {
                                continue middle;
                            }
                        }
                    }
                    else if (prop === 'extension') {
                        for (let i = 0; i < definedLanguagePropertValue.length; i++) {
                            const extensions = definedLanguagePropertValue[i].extension;
                            for (let ei = 0; ei < extensions.length; ei++) {
                                if (!requestedLanguagePropertyValue[i]) {
                                    continue middle;
                                }
                                if (extensions[ei] !== requestedLanguagePropertyValue[i].extension[ei]) {
                                    continue middle;
                                }
                            }
                        }
                    }

                    // Filter out non-matched properties.
                    else if (definedLanguagePropertValue !== requestedLanguagePropertyValue) {
                        continue middle;
                    }
                }

                result.push(definedLangTag.value);
            }
        }

        return result.length > 0 ? result : [this.defaultLanguageTag];

        function parseAndSortLanguageTags(languagePriorityList: string) {
            return stable(languagePriorityList.split(',').map((weightedLanguageRange) => {
                const components = weightedLanguageRange.replace(/\s+/, '').split(';');
                return {
                    tag: components[0],
                    quality: components[1] ? parseFloat(components[1].split('=')[1]) : 1.0
                };
            })

            // Filter non-defined language tags
            .filter((languageTag) => {
                if (!languageTag) {
                    return false;
                }
                if (!languageTag.tag) {
                    return false;
                }
                return languageTag;
            })

            // Sort by quality
            , (a, b) => {
                return b.quality - a.quality;
            });
        }
    }
}

function create() {
    const al = new AcceptLanguage();
    al.create = function() {
        return new AcceptLanguage();
    }
    return al;
}

declare var module: any;
module.exports = create();
module.exports.default = create();

export default create();
