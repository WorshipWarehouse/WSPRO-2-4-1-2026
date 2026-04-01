import * as protobuf from 'protobufjs';

// Define the ProPresenter 7 Protobuf schema using a JSON descriptor
// This is a simplified version of the greyshirtguy/ProPresenter7-Proto definitions
// focused on what's needed for a basic presentation with text slides.

const pro7Descriptor = {
  nested: {
    rv: {
      nested: {
        data: {
          nested: {
            UUID: {
              fields: {
                string: { type: "string", id: 1 }
              }
            },
            Color: {
              fields: {
                red: { type: "float", id: 1 },
                green: { type: "float", id: 2 },
                blue: { type: "float", id: 3 },
                alpha: { type: "float", id: 4 }
              }
            },
            ApplicationInfo: {
              fields: {
                platform: { type: "Platform", id: 1 },
                application: { type: "Application", id: 2 }
              },
              nested: {
                Platform: {
                  values: {
                    PLATFORM_UNDEFINED: 0,
                    PLATFORM_MACOS: 1,
                    PLATFORM_WINDOWS: 2
                  }
                },
                Application: {
                  values: {
                    APPLICATION_UNDEFINED: 0,
                    APPLICATION_PROPRESENTER: 1
                  }
                }
              }
            },
            Presentation: {
              fields: {
                uuid: { type: "UUID", id: 1 },
                name: { type: "string", id: 2 },
                applicationInfo: { type: "ApplicationInfo", id: 4 },
                cueGroups: { rule: "repeated", type: "CueGroup", id: 10 },
                cues: { rule: "repeated", type: "Cue", id: 11 },
                arrangements: { rule: "repeated", type: "Arrangement", id: 13 },
                selectedArrangement: { type: "UUID", id: 14 }
              },
              nested: {
                CueGroup: {
                  fields: {
                    group: { type: "Group", id: 1 },
                    cueIdentifiers: { rule: "repeated", type: "UUID", id: 2 }
                  }
                },
                Arrangement: {
                  fields: {
                    uuid: { type: "UUID", id: 1 },
                    name: { type: "string", id: 2 },
                    groupIdentifiers: { rule: "repeated", type: "UUID", id: 3 }
                  }
                }
              }
            },
            Group: {
              fields: {
                uuid: { type: "UUID", id: 1 },
                name: { type: "string", id: 2 },
                color: { type: "Color", id: 3 }
              }
            },
            Cue: {
              fields: {
                uuid: { type: "UUID", id: 1 },
                name: { type: "string", id: 2 },
                isEnabled: { type: "bool", id: 4 },
                actions: { rule: "repeated", type: "Action", id: 10 }
              }
            },
            Action: {
              fields: {
                uuid: { type: "UUID", id: 1 },
                isEnabled: { type: "bool", id: 3 },
                type: { type: "ActionType", id: 4 },
                label: { type: "Label", id: 5 },
                slide: { type: "SlideType", id: 10 }
              },
              nested: {
                ActionType: {
                  values: {
                    ACTION_TYPE_UNDEFINED: 0,
                    ACTION_TYPE_PRESENTATION_SLIDE: 2
                  }
                },
                Label: {
                  fields: {
                    text: { type: "string", id: 1 },
                    color: { type: "Color", id: 2 }
                  }
                },
                SlideType: {
                  fields: {
                    presentation: { type: "PresentationSlide", id: 1 }
                  }
                }
              }
            },
            PresentationSlide: {
              fields: {
                baseSlide: { type: "Slide", id: 1 }
              }
            },
            Slide: {
              fields: {
                uuid: { type: "UUID", id: 1 },
                name: { type: "string", id: 2 },
                isEnabled: { type: "bool", id: 3 },
                size: { type: "rv.graphics.Size", id: 5 },
                elements: { rule: "repeated", type: "Element", id: 10 }
              },
              nested: {
                Element: {
                  fields: {
                    element: { type: "rv.graphics.Element", id: 1 }
                  }
                }
              }
            }
          }
        },
        graphics: {
          nested: {
            Point: {
              fields: {
                x: { type: "double", id: 1 },
                y: { type: "double", id: 2 }
              }
            },
            Size: {
              fields: {
                width: { type: "double", id: 1 },
                height: { type: "double", id: 2 }
              }
            },
            Rect: {
              fields: {
                origin: { type: "Point", id: 1 },
                size: { type: "Size", id: 2 }
              }
            },
            Fill: {
              fields: {
                color: { type: "rv.data.Color", id: 1 }
              }
            },
            Text: {
              fields: {
                rtfData: { type: "bytes", id: 1 },
                verticalAlignment: { type: "VerticalAlignment", id: 3 }
              },
              nested: {
                VerticalAlignment: {
                  values: {
                    VERTICAL_ALIGNMENT_TOP: 0,
                    VERTICAL_ALIGNMENT_MIDDLE: 1,
                    VERTICAL_ALIGNMENT_BOTTOM: 2
                  }
                }
              }
            },
            Path: {
              fields: {
                shape: { type: "Shape", id: 1 }
              },
              nested: {
                Shape: {
                  fields: {
                    type: { type: "Type", id: 1 }
                  },
                  nested: {
                    Type: {
                      values: {
                        TYPE_UNDEFINED: 0,
                        TYPE_RECTANGLE: 1
                      }
                    }
                  }
                }
              }
            },
            Element: {
              fields: {
                uuid: { type: "rv.data.UUID", id: 1 },
                name: { type: "string", id: 2 },
                bounds: { type: "Rect", id: 4 },
                opacity: { type: "double", id: 5 },
                fill: { type: "Fill", id: 7 },
                text: { type: "Text", id: 8 },
                path: { type: "Path", id: 9 }
              }
            }
          }
        }
      }
    }
  }
};

const root = protobuf.Root.fromJSON(pro7Descriptor);
export const Presentation = root.lookupType("rv.data.Presentation");

export const encodePresentation = (data: any): Uint8Array => {
  const message = Presentation.fromObject(data);
  return Presentation.encode(message).finish();
};
