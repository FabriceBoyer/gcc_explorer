// FLAGS: -Wswitch-enum -Wswitch-default
enum color { RED, GREEN, BLUE };
int name_of(enum color c) {
    switch (c) {
    case RED:   return 0;
    case GREEN: return 1;
    }
    return -1;
}
